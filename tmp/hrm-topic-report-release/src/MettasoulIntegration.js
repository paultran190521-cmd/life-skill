/**
 * METTASOUL -> HRM teaching work-log integration.
 *
 * Security boundary:
 * - METTASOUL sends schedule facts only.
 * - HRM reloads the task, pay profile, assignment and context rates.
 * - One confirmed event creates exactly one WorkLogs row for one period.
 */

const METTASOUL_INTEGRATION_SCHEMA_ = Object.freeze({
  version: 1,
  source: "METTASOUL",
  signatureMaxAgeSeconds: 300,
  sheets: {
    profiles: "TeachingPayProfiles",
    contexts: "TeachingContextRates",
    assignments: "PayProfileAssignments",
    activityPolicies: "MettasoulActivityPolicies",
    mcpLedger: "MettasoulMcpLedger",
    versions: "TaskPolicyVersions",
    events: "IntegrationEvents"
  },
  config: {
    enabled: "METTASOUL_INTEGRATION_ENABLED",
    taskId: "METTASOUL_TEACHING_TASK_ID"
  },
  secretProperty: "METTASOUL_WEBHOOK_SECRET"
});

const TEACHING_PAY_PROFILE_HEADERS_ = [
  "ID", "Code", "Name", "AppliesToRoles", "WorkerCategory", "Unit",
  "BaseRate", "ManagementAllowance", "AllowContextRates",
  "EffectiveFrom", "EffectiveTo", "ConditionsJson", "Status", "Version",
  "UpdatedAt", "UpdatedBy"
];

const TEACHING_CONTEXT_RATE_HEADERS_ = [
  "ID", "ContextType", "ExternalCode", "Name", "Amount", "EffectiveFrom",
  "EffectiveTo", "McpPoints", "Status", "Version", "UpdatedAt", "UpdatedBy"
];

const PAY_PROFILE_ASSIGNMENT_HEADERS_ = [
  "ID", "UserEmail", "DefaultProfileCode", "WorkerCategory",
  "AssistantProfileCode", "EffectiveFrom", "EffectiveTo", "Status", "Version",
  "UpdatedAt", "UpdatedBy"
];

const ACTIVITY_POLICY_HEADERS_ = [
  "ID", "Code", "Name", "ActivityTypeCode", "RoleCode", "Unit", "CashAmount", "McpPoints",
  "RequiresEvidence", "EffectiveFrom", "EffectiveTo", "Status", "Version", "UpdatedAt", "UpdatedBy"
];

const MCP_LEDGER_HEADERS_ = [
  "ID", "UserEmail", "Points", "EntryType", "ReasonCode", "ReasonName", "Source", "ExternalEventId",
  "ActivityId", "AssignmentId", "WorkDate", "EvidenceUrl", "Status", "CreatedAt", "UpdatedAt"
];

const TASK_POLICY_VERSION_HEADERS_ = [
  "ID", "EntityType", "EntityId", "Version", "SnapshotJson", "ChangeType",
  "ChangedAt", "ChangedBy"
];

const INTEGRATION_EVENT_HEADERS_ = [
  "EventId", "IdempotencyKey", "Action", "Source", "PayloadHash", "Status",
  "WorkLogId", "UserEmail", "ScheduleId", "PeriodId", "ResponseJson",
  "ErrorMessage", "CreatedAt", "UpdatedAt"
];

const INTEGRATION_WORKLOG_HEADERS_ = [
  "Source", "ExternalEventId", "ScheduleId", "PeriodId", "RoleCode",
  "PolicyVersion", "RateProfileId", "CalculationJson", "ExternalStatus", "UpdatedAt"
];

// HRM-owned teaching policy.  These values deliberately do not come from
// METTASOUL payloads, so a client cannot alter payroll or KPI calculations.
const TEACHING_MCP_PER_PERIOD_ = 5;
const DOUBLE_PAY_DURATION_MINUTES_ = [90, 95];
// MCP is a travel KPI, not an automatic reward for every teaching period.
// The HRM-owned school context is deliberately used here: METTASOUL cannot
// choose its own MCP entitlement in the webhook payload.
const FAR_SCHOOL_MCP_CODES_ = ["S_8CE3530F", "S_F64787CC", "S_B55E24A3"];

function doPost(e) {
  try {
    const result = handleMettasoulWebhook_(e);
    return jsonOutput_(result);
  } catch (error) {
    return jsonOutput_({
      ok: false,
      code: error && error.code ? error.code : "INTERNAL_ERROR",
      message: error && error.message ? error.message : String(error)
    });
  }
}

function setupMettasoulIntegration_(actorEmail) {
  if (actorEmail) assertHrmAdmin_(actorEmail);
  const ss = getDatabase_();
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles, TEACHING_PAY_PROFILE_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.contexts, TEACHING_CONTEXT_RATE_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.assignments, PAY_PROFILE_ASSIGNMENT_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies, ACTIVITY_POLICY_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger, MCP_LEDGER_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.versions, TASK_POLICY_VERSION_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.events, INTEGRATION_EVENT_HEADERS_);
  ensureSystemConfigSheet_(ss);
  ensureWorkLogIntegrationColumns_(ss);
  ensureMettasoulIntegrationDefault_(ss);
  const seededProfiles = seedTeachingPayProfiles_(ss, actorEmail || "SYSTEM");
  const seededContexts = seedTeachingEnvironmentRates_(ss, actorEmail || "SYSTEM");
  const seededActivityPolicies = seedMettasoulActivityPolicies_(ss, actorEmail || "SYSTEM");
  return {
    success: true,
    message: "Đã chuẩn bị cấu trúc tích hợp METTASOUL. Chưa bật nhận chấm công.",
    schemaVersion: METTASOUL_INTEGRATION_SCHEMA_.version,
    seededProfiles: seededProfiles,
    seededContexts: seededContexts,
    seededActivityPolicies: seededActivityPolicies
  };
}

function getTeachingPayAdminData_(actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase_();
  setupMettasoulIntegration_(actorEmail);
  const secretConfigured = Boolean(
    PropertiesService.getScriptProperties().getProperty(METTASOUL_INTEGRATION_SCHEMA_.secretProperty)
  );
  return {
    profiles: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles)).map(serializeSheetObject_),
    contexts: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.contexts)).map(function(row) { return serializeSheetObject_(Object.assign({}, row, normalizeCode_(row.ContextType) === "ENVIRONMENT" && row.ExternalCode === "schoolyard_report" ? { Name: "Báo cáo chuyên đề" } : {})); }),
    assignments: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.assignments)).map(serializeSheetObject_),
    activityPolicies: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies)).map(function(row) { return serializeSheetObject_(Object.assign({}, row, row.ActivityTypeCode === "PARTNER_FREE_TOPIC" ? { Name: "Chuyên đề phụ huynh/giáo viên" } : {})); }),
    mcpLedger: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger)).map(serializeSheetObject_),
    tasks: getAllTasks_(),
    integration: {
      enabled: getMettasoulIntegrationEnabled_(ss),
      taskId: getMettasoulIntegrationTaskId_(ss),
      secretConfigured: secretConfigured,
      schemaVersion: METTASOUL_INTEGRATION_SCHEMA_.version
    }
  };
}

function saveTeachingPayProfile_(profile, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase_();
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles, TEACHING_PAY_PROFILE_HEADERS_);
  const normalized = normalizeTeachingPayProfile_(profile);
  const result = versionedUpsert_(
    ss,
    METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles,
    TEACHING_PAY_PROFILE_HEADERS_,
    normalized,
    "Code",
    "PAY_PROFILE",
    actorEmail,
    "TPR_"
  );
  return { success: true, profile: result };
}

function saveTeachingContextRate_(contextRate, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase_();
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.contexts, TEACHING_CONTEXT_RATE_HEADERS_);
  const normalized = normalizeTeachingContextRate_(contextRate);
  const result = versionedUpsert_(
    ss,
    METTASOUL_INTEGRATION_SCHEMA_.sheets.contexts,
    TEACHING_CONTEXT_RATE_HEADERS_,
    normalized,
    "ExternalCode",
    "CONTEXT_RATE",
    actorEmail,
    "TCR_",
    function(row) { return normalizeCode_(row.ContextType) === normalized.ContextType; }
  );
  return { success: true, contextRate: result };
}

function savePayProfileAssignment_(assignment, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase_();
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.assignments, PAY_PROFILE_ASSIGNMENT_HEADERS_);
  const normalized = normalizePayProfileAssignment_(assignment);
  assertHrmUserExists_(ss, normalized.UserEmail);
  if (normalized.DefaultProfileCode) assertProfileCodeConfigured_(ss, normalized.DefaultProfileCode, ["MAIN_TEACHER", "CO_TEACHER"]);
  if (normalized.AssistantProfileCode) assertProfileCodeConfigured_(ss, normalized.AssistantProfileCode, ["ASSISTANT"]);
  const result = versionedUpsert_(
    ss,
    METTASOUL_INTEGRATION_SCHEMA_.sheets.assignments,
    PAY_PROFILE_ASSIGNMENT_HEADERS_,
    normalized,
    "UserEmail",
    "PAY_ASSIGNMENT",
    actorEmail,
    "PPA_"
  );
  return { success: true, assignment: result };
}

function saveMettasoulActivityPolicy_(policy, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase_();
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies, ACTIVITY_POLICY_HEADERS_);
  const normalized = normalizeMettasoulActivityPolicy_(policy);
  const result = versionedUpsert_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies, ACTIVITY_POLICY_HEADERS_, normalized, "Code", "ACTIVITY_POLICY", actorEmail, "MAP_");
  return { success: true, activityPolicy: result };
}

/**
 * Applies a visible pilot policy without changing webhook state. Only HRM
 * workers provisioned from METTASOUL are included, plus the student assistant
 * explicitly identified by the administrator. Legacy HRM accounts stay intact.
 */
function applyMettasoulPilotPayPolicy_(actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase_();
  setupMettasoulIntegration_(actorEmail);
  const usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) throw integrationError_("USERS_SHEET_MISSING", "HRM chưa có bảng Users.");
  const userRows = usersSheet.getDataRange().getValues().slice(1);
  const studentEmail = "tranthien19057@gmail.com";
  const managedWorkers = userRows.map(function(row) {
    const settings = safeParseJson_(row[5], {});
    return {
      email: String(row[0] || "").trim().toLowerCase(),
      managed: normalizeCode_(settings.identityProvider) === "METTASOUL" || normalizeCode_(row[10]) === "METTASOUL"
    };
  }).filter(function(worker) {
    return worker.email && worker.managed;
  });
  const studentExists = userRows.some(function(row) {
    return String(row[0] || "").trim().toLowerCase() === studentEmail;
  });
  if (!studentExists) throw integrationError_("STUDENT_ASSISTANT_NOT_FOUND", "Chưa tìm thấy tài khoản trợ giảng sinh viên trong HRM.");

  const teachers = managedWorkers.sort(function(left, right) { return left.email.localeCompare(right.email); });
  const assignments = teachers.map(function(worker, index) {
    return { UserEmail: worker.email, DefaultProfileCode: ["TEACHER_A", "TEACHER_B", "TEACHER_C"][index % 3], WorkerCategory: "PROFESSIONAL_TEACHER", AssistantProfileCode: "ASSISTANT_PRO", Status: "Active" };
  }).concat([{ UserEmail: studentEmail, DefaultProfileCode: "", WorkerCategory: "STUDENT_ASSISTANT", AssistantProfileCode: "ASSISTANT_STUDENT", Status: "Active" }]);

  assignments.forEach(function(assignment) { savePayProfileAssignment_(assignment, actorEmail); });
  saveTeachingContextRate_({ ContextType: "SCHOOL", ExternalCode: "s-8ce3530f", Name: "TRƯỜNG THPT TÂN TÚC — BÌNH CHÁNH", Amount: 15000, McpPoints: 5, Status: "Active" }, actorEmail);
  saveTeachingContextRate_({ ContextType: "SCHOOL", ExternalCode: "s-f64787cc", Name: "TRƯỜNG THPT PHONG PHÚ — BÌNH CHÁNH", Amount: 0, McpPoints: 5, Status: "Active" }, actorEmail);
  saveTeachingContextRate_({ ContextType: "SCHOOL", ExternalCode: "s-b55e24a3", Name: "TRƯỜNG PT NK TDTT BÌNH CHÁNH — BÌNH CHÁNH", Amount: 15000, McpPoints: 5, Status: "Active" }, actorEmail);
  return { success: true, assignedTeachers: teachers.length, assignedProfessionalAssistants: teachers.length, assignedStudentAssistants: 1, farSchoolContexts: 3, integrationEnabled: getMettasoulIntegrationEnabled_(ss) };
}

/**
 * Creates HRM worker records from the METTASOUL identity directory without
 * creating a second, usable HRM password.  Pay-profile assignment remains a
 * separate explicit admin action.
 */
function provisionMettasoulWorkersFromJson_(jsonText, actorEmail) {
  assertHrmAdmin_(actorEmail);
  let identities;
  try {
    identities = JSON.parse(String(jsonText || "[]"));
  } catch (error) {
    throw integrationError_("IDENTITY_JSON_INVALID", "Danh sách định danh METTASOUL phải là JSON hợp lệ.");
  }
  return provisionMettasoulWorkers_(identities, actorEmail);
}

function provisionMettasoulWorkers_(identities, actorEmail) {
  if (!Array.isArray(identities) || identities.length === 0) {
    throw integrationError_("IDENTITY_LIST_REQUIRED", "Cần ít nhất một định danh METTASOUL để tạo hồ sơ nhân sự.");
  }
  const ss = getDatabase_();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) throw integrationError_("USERS_SHEET_MISSING", "HRM chưa có bảng Users.");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const existing = new Set(values.slice(1).map(function(row) {
    return String(row[headers.indexOf("Email")] || "").trim().toLowerCase();
  }).filter(Boolean));
  const unique = new Map();
  identities.forEach(function(identity) {
    const email = String(identity && identity.email || "").trim().toLowerCase();
    const name = String(identity && identity.name || "").trim();
    if (!email || !name) return;
    unique.set(email, Object.assign({}, identity, { email: email, name: name }));
  });
  const now = new Date();
  const rows = [];
  const skipped = [];
  unique.forEach(function(identity, email) {
    if (existing.has(email)) {
      skipped.push(email);
      return;
    }
    rows.push(buildMettasoulWorkerRow_(headers, identity, now));
  });
  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  }
  appendPolicyVersion_(ss, "IDENTITY_PROVISION", "METTASOUL", 1, {
    requested: identities.length,
    created: rows.length,
    skipped: skipped.length
  }, "CREATE", actorEmail);
  return {
    success: true,
    created: rows.length,
    skipped: skipped.length,
    message: "Đã tạo " + rows.length + " hồ sơ nhân sự do METTASOUL quản lý. Chưa gán bậc lương."
  };
}

function buildMettasoulWorkerRow_(headers, identity, now, allowedTaskId) {
  const teacherId = String(identity.teacherId || "").trim();
  const settings = {
    identityProvider: "METTASOUL",
    managedBy: "METTASOUL",
    mettasoulUserId: String(identity.userId || "").trim(),
    mettasoulTeacherId: teacherId,
    mettasoulRole: String(identity.role || "").trim(),
    provisionedAt: now.toISOString()
  };
  if (allowedTaskId) settings.allowedTasks = [String(allowedTaskId)];
  // Users is a legacy HRM sheet whose column labels vary between deployments,
  // while its server code reads fixed positions. Populate those positions
  // rather than depending on presentation labels.
  const row = new Array(headers.length).fill("");
  const values = [
    identity.email, "", "user", identity.name,
    "MTS_" + (teacherId || Utilities.getUuid()), JSON.stringify(settings), 0,
    "METTASOUL_MANAGED", "", teacherId ? "MTS-" + teacherId : "",
    "METTASOUL", "", String(identity.avatarUrl || "").trim(), "", "", ""
  ];
  values.forEach(function(value, index) {
    if (index < row.length) row[index] = value;
  });
  return row;
}

function saveMettasoulIntegrationSettings_(settings, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (error) {
    throw integrationError_("SYSTEM_BUSY", "HRM đang lưu cấu hình khác, vui lòng thử lại.");
  }
  try {
  settings = settings || {};
  const ss = getDatabase_();
  setupMettasoulIntegration_(actorEmail);
  const taskId = String(settings.taskId || "").trim();
  const enabled = settings.enabled === true;
  const newSecret = String(settings.secret || "").trim();

  if (enabled && !taskId) throw integrationError_("CONFIG_TASK_REQUIRED", "Phải chọn công việc HRM trước khi bật tích hợp.");
  if (taskId) getAuthoritativeTaskById_(ss, taskId);
  if (newSecret && newSecret.length < 32) {
    throw integrationError_("SECRET_TOO_SHORT", "Khóa ký webhook phải có ít nhất 32 ký tự.");
  }
  if (newSecret) {
    PropertiesService.getScriptProperties().setProperty(METTASOUL_INTEGRATION_SCHEMA_.secretProperty, newSecret);
  }
  if (enabled && !PropertiesService.getScriptProperties().getProperty(METTASOUL_INTEGRATION_SCHEMA_.secretProperty)) {
    throw integrationError_("SECRET_REQUIRED", "Chưa cấu hình khóa ký webhook.");
  }

  setSystemConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.taskId, taskId);
  setSystemConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled, enabled ? "true" : "false");
  PropertiesService.getScriptProperties().setProperties({
    METTASOUL_INTEGRATION_ENABLED_BACKUP: enabled ? "true" : "false",
    METTASOUL_TEACHING_TASK_ID_BACKUP: taskId
  }, false);
  const storedEnabled = getMettasoulIntegrationEnabled_(ss);
  const storedTaskId = getMettasoulIntegrationTaskId_(ss);
  if (storedEnabled !== enabled || storedTaskId !== taskId) {
    throw integrationError_("CONFIG_SAVE_VERIFY_FAILED", "HRM không xác nhận được cấu hình vừa lưu.");
  }
  appendPolicyVersion_(ss, "INTEGRATION_SETTINGS", "METTASOUL", 1, {
    enabled: enabled,
    taskId: taskId,
    secretChanged: Boolean(newSecret)
  }, "UPDATE", actorEmail);
  return {
    success: true,
    enabled: storedEnabled,
    taskId: storedTaskId,
    secretConfigured: Boolean(PropertiesService.getScriptProperties().getProperty(METTASOUL_INTEGRATION_SCHEMA_.secretProperty))
  };
  } finally {
    lock.releaseLock();
  }
}

function handleMettasoulWebhook_(e) {
  const raw = e && e.postData ? String(e.postData.contents || "") : "";
  if (!raw) throw integrationError_("EMPTY_REQUEST", "Yêu cầu không có nội dung.");
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch (error) {
    throw integrationError_("INVALID_JSON", "Nội dung webhook không phải JSON hợp lệ.");
  }

  const secret = PropertiesService.getScriptProperties().getProperty(METTASOUL_INTEGRATION_SCHEMA_.secretProperty);
  if (!secret) throw integrationError_("INTEGRATION_NOT_CONFIGURED", "HRM chưa cấu hình khóa tích hợp.");
  const verified = verifyMettasoulEnvelope_(envelope, secret, Date.now());
  let payload;
  try {
    payload = JSON.parse(verified.payloadText);
  } catch (error) {
    throw integrationError_("INVALID_PAYLOAD", "Payload đã ký không phải JSON hợp lệ.");
  }

  if (normalizeCode_(payload.source) !== METTASOUL_INTEGRATION_SCHEMA_.source) {
    throw integrationError_("INVALID_SOURCE", "Nguồn sự kiện không hợp lệ.");
  }
  const action = normalizeCode_(payload.action);
  if (action === "PING") {
    return { ok: true, code: "READY", schemaVersion: METTASOUL_INTEGRATION_SCHEMA_.version, policyContracts: ["TOPIC_REPORT_V1"], cancellationReports: true };
  }
  if (action === "GET_TOPIC_REPORT_POLICIES") return getTopicReportPolicies_();
  if (action === "GET_MCP_LEDGER") return getMettasoulMcpLedger_(payload);
  if (action === "PROVISION_WORKER") return provisionMettasoulWorkerFromWebhook_(payload, verified.payloadHash);
  if (action === "SUBMIT_TEACHING_PERIOD") return submitTeachingPeriod_(payload, verified.payloadHash);
  if (action === "SUBMIT_SCHEDULE_COMPLETION") return submitTeachingPeriod_(payload, verified.payloadHash);
  if (action === "REPORT_CANCELLED_PERIOD") return reportCancelledPeriod_(payload, verified.payloadHash);
  if (action === "SUBMIT_ACTIVITY_COMPLETION") return submitActivityCompletion_(payload, verified.payloadHash);
  if (action === "CANCEL_ACTIVITY_COMPLETION") return cancelActivityCompletion_(payload, verified.payloadHash);
  if (action === "CANCEL_TEACHING_PERIOD") return cancelTeachingPeriod_(payload, verified.payloadHash);
  throw integrationError_("UNSUPPORTED_ACTION", "Nghiệp vụ webhook chưa được hỗ trợ.");
}

/**
 * Read-only MCP view for the signed METTASOUL session.  HRM remains the
 * ledger authority; this exposes only the requesting user's active credits
 * and reversals, never a cross-user report or a payroll mutation.
 */
function getMettasoulMcpLedger_(payload) {
  const userEmail = String(payload && payload.userEmail || "").trim().toLowerCase();
  if (!userEmail) throw integrationError_("USER_EMAIL_REQUIRED", "Thiếu email nhân sự cần xem MCP.");

  const ss = getDatabase_();
  const sheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger);
  if (!sheet) throw integrationError_("MCP_LEDGER_MISSING", "HRM chưa có sổ MCP METTASOUL.");

  const entries = readSheetObjects_(sheet)
    .filter(function(row) {
      return String(row.UserEmail || "").trim().toLowerCase() === userEmail &&
        normalizeCode_(row.Status || "ACTIVE") !== "DELETED";
    })
    .sort(function(left, right) {
      return String(right.CreatedAt || right.WorkDate || "").localeCompare(String(left.CreatedAt || left.WorkDate || ""));
    })
    .map(function(row) {
      return {
        id: String(row.ID || ""),
        points: Number(row.Points || 0),
        entryType: normalizeCode_(row.EntryType || "CREDIT"),
        reasonCode: String(row.ReasonCode || ""),
        reasonName: String(row.ReasonName || ""),
        schoolName: String(row.SchoolName || ""),
        workDate: String(row.WorkDate || ""),
        status: String(row.Status || "Active"),
        createdAt: row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : String(row.CreatedAt || "")
      };
    });

  return {
    ok: true,
    code: "MCP_LEDGER_READY",
    userEmail: userEmail,
    entries: entries,
    totalPoints: entries.reduce(function(total, entry) { return total + Number(entry.points || 0); }, 0),
    schemaVersion: METTASOUL_INTEGRATION_SCHEMA_.version
  };
}

function verifyMettasoulEnvelope_(envelope, secret, nowMs) {
  envelope = envelope || {};
  const version = String(envelope.version || "");
  const timestamp = Number(envelope.timestamp);
  const nonce = String(envelope.nonce || "");
  const payloadText = String(envelope.payload || "");
  const signature = String(envelope.signature || "").toLowerCase();
  if (version !== "1" || !timestamp || !nonce || !payloadText || !signature) {
    throw integrationError_("INVALID_ENVELOPE", "Thiếu thành phần chữ ký webhook.");
  }
  const ageSeconds = Math.abs(Math.floor(nowMs / 1000) - timestamp);
  if (ageSeconds > METTASOUL_INTEGRATION_SCHEMA_.signatureMaxAgeSeconds) {
    throw integrationError_("EXPIRED_SIGNATURE", "Chữ ký webhook đã hết hạn.");
  }
  const signedText = timestamp + "." + nonce + "." + payloadText;
  const expected = bytesToHex_(Utilities.computeHmacSha256Signature(signedText, secret, Utilities.Charset.UTF_8));
  if (!constantTimeEquals_(expected, signature)) {
    throw integrationError_("INVALID_SIGNATURE", "Chữ ký webhook không hợp lệ.");
  }
  return {
    payloadText: payloadText,
    payloadHash: bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, payloadText, Utilities.Charset.UTF_8))
  };
}

/**
 * Creates only a minimal HRM profile for a new METTASOUL teacher. The source
 * may never send payroll fields. HRM grants the already configured teaching
 * task and keeps rate/policy authority locally.
 */
function provisionMettasoulWorkerFromWebhook_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (error) {
    throw integrationError_("SYSTEM_BUSY", "HRM đang xử lý yêu cầu khác, vui lòng thử lại.");
  }
  try {
    const ss = getDatabase_();
    assertIntegrationReady_(ss);
    const input = normalizeIdentityProvisionPayload_(payload);
    const prior = findIntegrationEventByKey_(ss, input.idempotencyKey);
    if (prior && normalizeCode_(prior.Status) === "CONFIRMED") {
      const previous = safeParseJson_(prior.ResponseJson, {});
      previous.idempotent = true;
      return previous;
    }
    const taskId = getMettasoulIntegrationTaskId_(ss);
    const task = getAuthoritativeTaskById_(ss, taskId);
    const sheet = ss.getSheetByName("Users");
    ensureUsersExtendedColumns_(sheet);
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(String);
    const emailIndex = headers.indexOf("Email");
    const existingIndex = values.slice(1).findIndex(function(row) {
      return String(row[emailIndex] || "").trim().toLowerCase() === input.userEmail;
    });
    let created = false;
    if (existingIndex < 0) {
      const row = buildMettasoulWorkerRow_(headers, input, new Date(), taskId);
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
      created = true;
    } else {
      const rowNumber = existingIndex + 2;
      const row = values[existingIndex + 1].slice();
      const settings = safeParseJson_(row[5], {});
      const managed = normalizeCode_(settings.identityProvider) === "METTASOUL" || normalizeCode_(row[10]) === "METTASOUL";
      if (!managed) throw integrationError_("IDENTITY_CONFLICT", "Email đã thuộc một hồ sơ HRM độc lập; không tự động thay đổi quyền công việc.");
      settings.identityProvider = "METTASOUL";
      settings.managedBy = "METTASOUL";
      settings.mettasoulUserId = input.userId;
      settings.mettasoulTeacherId = input.teacherId;
      settings.mettasoulRole = input.role;
      settings.allowedTasks = Array.from(new Set((Array.isArray(settings.allowedTasks) ? settings.allowedTasks : []).concat([taskId])));
      row[5] = JSON.stringify(settings);
      if (!String(row[12] || "").trim() && input.avatarUrl) row[12] = input.avatarUrl;
      sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);
    }
    const response = { ok: true, code: "CONFIRMED", eventId: input.eventId, idempotencyKey: input.idempotencyKey, userEmail: input.userEmail, created: created, taskId: task.ID || task.TaskID || taskId, taskName: task.Name || "Dạy kỹ năng sống" };
    upsertIntegrationEvent_(ss, { EventId: input.eventId, IdempotencyKey: input.idempotencyKey, Action: "PROVISION_WORKER", Source: METTASOUL_INTEGRATION_SCHEMA_.source, PayloadHash: payloadHash, Status: "CONFIRMED", WorkLogId: "", UserEmail: input.userEmail, ScheduleId: "", PeriodId: "", ResponseJson: JSON.stringify(response), ErrorMessage: "" });
    return response;
  } finally {
    lock.releaseLock();
  }
}

function normalizeIdentityProvisionPayload_(payload) {
  const input = payload || {};
  const userEmail = String(input.userEmail || "").trim().toLowerCase();
  const name = String(input.name || "").trim();
  const teacherId = String(input.teacherId || "").trim();
  if (!/^\S+@\S+\.\S+$/.test(userEmail) || !name || !teacherId) {
    throw integrationError_("IDENTITY_REQUIRED", "Hồ sơ mới cần họ tên, email và mã giáo viên METTASOUL.");
  }
  if (normalizeCode_(input.role) !== "TEACHER") throw integrationError_("INVALID_IDENTITY_ROLE", "Chỉ giáo viên METTASOUL được tự động tạo hồ sơ HRM.");
  const eventId = String(input.eventId || "").trim();
  const idempotencyKey = String(input.idempotencyKey || "").trim();
  if (!eventId || !idempotencyKey) throw integrationError_("EVENT_ID_REQUIRED", "Thiếu mã sự kiện đồng bộ.");
  return { eventId: eventId, idempotencyKey: idempotencyKey, userId: String(input.userId || "").trim(), teacherId: teacherId, name: name, userEmail: userEmail, role: "teacher", avatarUrl: String(input.avatarUrl || "").trim() };
}

function submitTeachingPeriod_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  try {
    // Do not queue a teacher behind a long-running request for ten seconds.
    // METTASOUL keeps a PENDING outbox record and retries the same idempotency
    // key, so a short contention response is both safe and much faster.
    if (!lock.tryLock(500)) {
      throw integrationError_("SYSTEM_BUSY", "HRM đang hoàn tất một yêu cầu khác. METTASOUL sẽ tự đối chiếu lại.");
    }
  } catch (error) {
    if (error && error.code === "SYSTEM_BUSY") throw error;
    throw integrationError_("SYSTEM_BUSY", "HRM đang hoàn tất một yêu cầu khác. METTASOUL sẽ tự đối chiếu lại.");
  }

  try {
    const ss = getDatabase_();
    assertIntegrationReady_(ss);
    const input = normalizeTeachingPeriodPayload_(payload);
    assertPeriodNotReportedCancelled_(ss, input.idempotencyKey);
    const existing = findIntegrationEventByKey_(ss, input.idempotencyKey);
    if (existing && normalizeCode_(existing.Status) === "CONFIRMED") {
      const previous = safeParseJson_(existing.ResponseJson, {});
      previous.idempotent = true;
      return previous;
    }

    upsertIntegrationEvent_(ss, {
      EventId: input.eventId,
      IdempotencyKey: input.idempotencyKey,
      Action: "SUBMIT_TEACHING_PERIOD",
      Source: METTASOUL_INTEGRATION_SCHEMA_.source,
      PayloadHash: payloadHash,
      Status: "PROCESSING",
      WorkLogId: "",
      UserEmail: input.userEmail,
      ScheduleId: input.scheduleId,
      PeriodId: input.periodId,
      ResponseJson: "",
      ErrorMessage: ""
    });

    try {
      assertPeriodEnded_(input.periodEndAt);
      const month = input.workDate.slice(0, 7);
      if (checkIsLocked_(month)) throw integrationError_("PAYROLL_LOCKED", "Tháng " + month + " đã khóa sổ.");
      assertHrmUserExists_(ss, input.userEmail);
      const assignment = resolvePayAssignment_(ss, input.userEmail, input.workDate);
      const profile = input.activityTypeCode && input.roleCode !== "ASSISTANT"
        ? { ID: "ACTIVITY", Code: "ACTIVITY", BaseRate: 0 }
        : resolveTeachingPayProfile_(ss, assignment, input.roleCode, input.workDate);
      const taskId = getMettasoulIntegrationTaskId_(ss);
      const task = getAuthoritativeTaskById_(ss, taskId);
      let calculation = input.activityTypeCode
        ? calculateScheduledTopicPay_(ss, input, profile)
        : calculateTeachingPeriodPay_(ss, input, profile);
      if (!input.activityTypeCode && input.environmentCode === "schoolyard_report") throw integrationError_("ACTIVITY_TYPE_REQUIRED", "Lịch chuyên đề cần chọn loại hoạt động.");
      const durableWorkLog = findDurableTeachingWorkLog_(ss, input.eventId);
      const workLogId = durableWorkLog ? String(durableWorkLog.ID) : "LOG_MTS_" + input.eventId;
      if (durableWorkLog) {
        if (normalizeCode_(durableWorkLog.Status) !== "ACTIVE") throw integrationError_("PERIOD_CANCELLED", "Dòng công đã bị hủy.");
        const snapshot = safeParseJson_(durableWorkLog.InputData, {}).calculation;
        if (!snapshot || !isFinite(Number(snapshot.total))) throw integrationError_("WORKLOG_NEEDS_REVIEW", "Dòng công chưa đủ dữ liệu; cần admin đối chiếu.");
        calculation = snapshot;
      } else appendIntegratedWorkLog_(ss, workLogId, task, input, profile, calculation);
      const mcpLedgerId = awardTeachingContextMcp_(ss, input, calculation);
      const response = {
        ok: true,
        code: "WORKLOG_CREATED",
        eventId: input.eventId,
        idempotencyKey: input.idempotencyKey,
        workLogId: workLogId,
        mcpLedgerId: mcpLedgerId,
        money: calculation.total,
        mcpPoints: calculation.mcpPoints,
        currency: "VND",
        policyVersion: calculation.policyVersion,
        idempotent: false
      };
      upsertIntegrationEvent_(ss, {
        EventId: input.eventId,
        IdempotencyKey: input.idempotencyKey,
        Action: "SUBMIT_TEACHING_PERIOD",
        Source: METTASOUL_INTEGRATION_SCHEMA_.source,
        PayloadHash: payloadHash,
        Status: "CONFIRMED",
        WorkLogId: workLogId,
        UserEmail: input.userEmail,
        ScheduleId: input.scheduleId,
        PeriodId: input.periodId,
        ResponseJson: JSON.stringify(response),
        ErrorMessage: ""
      });
      return response;
    } catch (businessError) {
      upsertIntegrationEvent_(ss, {
        EventId: input.eventId,
        IdempotencyKey: input.idempotencyKey,
        Action: "SUBMIT_TEACHING_PERIOD",
        Source: METTASOUL_INTEGRATION_SCHEMA_.source,
        PayloadHash: payloadHash,
        Status: "FAILED",
        WorkLogId: "",
        UserEmail: input.userEmail,
        ScheduleId: input.scheduleId,
        PeriodId: input.periodId,
        ResponseJson: "",
        ErrorMessage: businessError.message || String(businessError)
      });
      throw businessError;
    }
  } finally {
    lock.releaseLock();
  }
}

function submitActivityCompletion_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (error) { throw integrationError_("SYSTEM_BUSY", "HRM đang xử lý yêu cầu khác, vui lòng thử lại."); }
  try {
    const ss = getDatabase_();
    assertIntegrationReady_(ss);
    ensureWorkLogIntegrationColumns_(ss);
    const input = normalizeActivityCompletionPayload_(payload);
    const existing = findIntegrationEventByKey_(ss, input.idempotencyKey);
    if (existing && normalizeCode_(existing.Status) === "CONFIRMED") {
      const previous = safeParseJson_(existing.ResponseJson, {});
      previous.idempotent = true;
      return previous;
    }
    upsertIntegrationEvent_(ss, {
      EventId: input.eventId, IdempotencyKey: input.idempotencyKey, Action: "SUBMIT_ACTIVITY_COMPLETION",
      Source: METTASOUL_INTEGRATION_SCHEMA_.source, PayloadHash: payloadHash, Status: "PROCESSING", WorkLogId: "",
      UserEmail: input.userEmail, ScheduleId: input.activityId, PeriodId: input.assignmentId, ResponseJson: "", ErrorMessage: ""
    });
    try {
      if (checkIsLocked_(input.workDate.slice(0, 7))) throw integrationError_("PAYROLL_LOCKED", "Tháng " + input.workDate.slice(0, 7) + " đã khóa sổ.");
      assertHrmUserExists_(ss, input.userEmail);
      const policy = resolveActivityPolicy_(ss, input);
      if (toBoolean_(policy.RequiresEvidence) && !input.evidenceUrl) throw integrationError_("EVIDENCE_REQUIRED", "Hoạt động này cần minh chứng trước khi duyệt.");
      const cashAmount = toNonNegativeNumber_(policy.CashAmount, "Thù lao công việc");
      const mcpPoints = toNonNegativeNumber_(policy.McpPoints, "Điểm MCP");
      let workLogId = "";
      if (cashAmount > 0) {
        const taskId = getMettasoulIntegrationTaskId_(ss);
        const task = getAuthoritativeTaskById_(ss, taskId);
        workLogId = "LOG_MTS_ACT_" + Utilities.getUuid();
        appendIntegratedActivityWorkLog_(ss, workLogId, task, input, policy, cashAmount);
      }
      let mcpLedgerId = "";
      if (mcpPoints > 0) {
        mcpLedgerId = "MCP_MTS_" + Utilities.getUuid();
        appendObjectRow_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger), {
          ID: mcpLedgerId, UserEmail: input.userEmail, Points: mcpPoints, EntryType: "CREDIT",
          ReasonCode: policy.Code, ReasonName: policy.Name, Source: METTASOUL_INTEGRATION_SCHEMA_.source,
          ExternalEventId: input.eventId, ActivityId: input.activityId, AssignmentId: input.assignmentId,
          WorkDate: input.workDate, EvidenceUrl: input.evidenceUrl, Status: "Active", CreatedAt: new Date(), UpdatedAt: new Date()
        });
      }
      const response = { ok: true, code: "ACTIVITY_REWARDED", eventId: input.eventId, idempotencyKey: input.idempotencyKey, workLogId: workLogId, mcpLedgerId: mcpLedgerId, money: cashAmount, mcpPoints: mcpPoints, currency: "VND", policyVersion: "ACTIVITY_POLICY:" + String(policy.Version || 1), idempotent: false };
      upsertIntegrationEvent_(ss, { EventId: input.eventId, IdempotencyKey: input.idempotencyKey, Action: "SUBMIT_ACTIVITY_COMPLETION", Source: METTASOUL_INTEGRATION_SCHEMA_.source, PayloadHash: payloadHash, Status: "CONFIRMED", WorkLogId: workLogId, UserEmail: input.userEmail, ScheduleId: input.activityId, PeriodId: input.assignmentId, ResponseJson: JSON.stringify(response), ErrorMessage: "" });
      return response;
    } catch (businessError) {
      upsertIntegrationEvent_(ss, { EventId: input.eventId, IdempotencyKey: input.idempotencyKey, Action: "SUBMIT_ACTIVITY_COMPLETION", Source: METTASOUL_INTEGRATION_SCHEMA_.source, PayloadHash: payloadHash, Status: "FAILED", WorkLogId: "", UserEmail: input.userEmail, ScheduleId: input.activityId, PeriodId: input.assignmentId, ResponseJson: "", ErrorMessage: businessError.message || String(businessError) });
      throw businessError;
    }
  } finally { lock.releaseLock(); }
}

function normalizeActivityCompletionPayload_(payload) {
  const result = {
    eventId: String(payload.eventId || "").trim(), idempotencyKey: String(payload.idempotencyKey || "").trim(),
    activityId: String(payload.activityId || "").trim(), assignmentId: String(payload.assignmentId || "").trim(),
    activityTypeCode: normalizeCode_(payload.activityTypeCode), activityTitle: String(payload.activityTitle || "").trim(),
    userEmail: String(payload.userEmail || "").trim().toLowerCase(), roleCode: normalizeCode_(payload.roleCode || "PARTICIPANT"),
    unit: normalizeCode_(payload.unit), workDate: String(payload.workDate || "").trim(), evidenceUrl: String(payload.evidenceUrl || "").trim()
  };
  ["eventId", "idempotencyKey", "activityId", "assignmentId", "activityTypeCode", "userEmail", "unit", "workDate"].forEach(function(key) {
    if (!result[key]) throw integrationError_("MISSING_FIELD", "Thiếu trường bắt buộc: " + key);
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.workDate)) throw integrationError_("INVALID_WORK_DATE", "Ngày hoạt động phải có định dạng yyyy-MM-dd.");
  return result;
}

function resolveActivityPolicy_(ss, input) {
  const rows = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies));
  const found = rows.find(function(row) {
    const role = normalizeCode_(row.RoleCode || "ALL");
    return normalizeCode_(row.ActivityTypeCode) === input.activityTypeCode &&
      (role === "ALL" || role === input.roleCode) && normalizeCode_(row.Unit) === input.unit && isEffectiveRow_(row, input.workDate);
  });
  if (!found) throw integrationError_("ACTIVITY_POLICY_MISSING", "HRM chưa cấu hình chính sách cho hoạt động " + input.activityTypeCode + ".");
  return found;
}

function appendIntegratedActivityWorkLog_(ss, workLogId, task, input, policy, money) {
  appendObjectRow_(ss.getSheetByName("WorkLogs"), {
    ID: workLogId, UserEmail: input.userEmail, TaskId: task.id, TaskName: task.name,
    InputData: JSON.stringify({ integration: { source: METTASOUL_INTEGRATION_SCHEMA_.source, eventId: input.eventId, idempotencyKey: input.idempotencyKey, activityId: input.activityId, assignmentId: input.assignmentId }, activity: { typeCode: input.activityTypeCode, title: input.activityTitle, roleCode: input.roleCode, unit: input.unit, evidenceUrl: input.evidenceUrl }, calculation: { money: money, policyCode: policy.Code } }),
    Quantity: 1, Money: money, Timestamp: new Date(), Date: input.workDate, Status: "Active", Source: METTASOUL_INTEGRATION_SCHEMA_.source,
    ExternalEventId: input.eventId, ScheduleId: input.activityId, PeriodId: input.assignmentId, RoleCode: input.roleCode,
    PolicyVersion: "ACTIVITY_POLICY:" + String(policy.Version || 1), RateProfileId: policy.ID, CalculationJson: JSON.stringify({ money: money, policyCode: policy.Code }), ExternalStatus: "CONFIRMED", UpdatedAt: new Date()
  });
}

function cancelActivityCompletion_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (error) { throw integrationError_("SYSTEM_BUSY", "HRM đang xử lý yêu cầu khác, vui lòng thử lại."); }
  try {
    const ss = getDatabase_();
    assertIntegrationReady_(ss);
    const targetKey = String(payload.targetIdempotencyKey || "").trim();
    const requestedEventId = String(payload.eventId || "").trim();
    if (!targetKey || !requestedEventId) throw integrationError_("INVALID_CANCEL_REQUEST", "Thiếu khóa quyền lợi hoạt động cần hủy.");
    const original = findConfirmedActivityIntegrationEvent_(ss, payload, targetKey);
    if (!original || normalizeCode_(original.Status) !== "CONFIRMED" || normalizeCode_(original.Action) !== "SUBMIT_ACTIVITY_COMPLETION") {
      throw integrationError_("ACTIVITY_REWARD_NOT_FOUND", "Không tìm thấy quyền lợi hoạt động đang hiệu lực.");
    }
    const cancellationKey = "CANCEL:" + targetKey;
    const existingCancellation = findIntegrationEventByKey_(ss, cancellationKey);
    const cancellationEventId = existingCancellation && existingCancellation.EventId
      ? String(existingCancellation.EventId)
      : requestedEventId;
    const workDate = findActivityRewardDate_(ss, original);
    if (workDate && checkIsLocked_(workDate.slice(0, 7))) {
      throw integrationError_("PAYROLL_LOCKED", "Tháng chứa quyền lợi hoạt động đã khóa sổ.");
    }
    const workLogWasPresent = original.WorkLogId ? markWorkLogDeleted_(ss, original.WorkLogId) : false;
    const mcpReversal = reverseActivityMcp_(ss, original, cancellationEventId);
    const response = {
      ok: true,
      code: "ACTIVITY_REWARD_CANCELLED",
      eventId: cancellationEventId,
      targetIdempotencyKey: targetKey,
      workLogId: String(original.WorkLogId || ""),
      workLogWasPresent: workLogWasPresent,
      mcpReversalPoints: mcpReversal.points,
      mcpReversalLedgerId: mcpReversal.ledgerId,
      idempotent: Boolean(existingCancellation && normalizeCode_(existingCancellation.Status) === "CONFIRMED")
    };
    upsertIntegrationEvent_(ss, {
      EventId: cancellationEventId, IdempotencyKey: cancellationKey, Action: "CANCEL_ACTIVITY_COMPLETION",
      Source: METTASOUL_INTEGRATION_SCHEMA_.source, PayloadHash: payloadHash, Status: "CONFIRMED",
      WorkLogId: String(original.WorkLogId || ""), UserEmail: original.UserEmail,
      ScheduleId: original.ScheduleId, PeriodId: original.PeriodId,
      ResponseJson: JSON.stringify(response), ErrorMessage: ""
    });
    return response;
  } finally { lock.releaseLock(); }
}

function findActivityRewardDate_(ss, originalEvent) {
  const workLogId = String(originalEvent.WorkLogId || "");
  if (workLogId) {
    const workLog = readWorkLogObjects_(ss).find(function(row) {
      return String(row.ID || "") === workLogId;
    });
    if (workLog && workLog.Date) return toYmd_(workLog.Date);
  }
  const credit = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger)).find(function(row) {
    return normalizeCode_(row.EntryType || "CREDIT") === "CREDIT" &&
      String(row.ExternalEventId || "") === String(originalEvent.EventId || "");
  });
  return credit && credit.WorkDate ? toYmd_(credit.WorkDate) : "";
}

function reverseActivityMcp_(ss, originalEvent, cancellationEventId) {
  const sheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger);
  const rows = readSheetObjects_(sheet);
  const existing = rows.find(function(row) {
    return normalizeCode_(row.EntryType) === "REVERSAL" && String(row.ExternalEventId || "") === String(cancellationEventId || "");
  });
  if (existing) return { ledgerId: String(existing.ID || ""), points: Number(existing.Points || 0) };
  const credit = rows.find(function(row) {
    return normalizeCode_(row.EntryType || "CREDIT") === "CREDIT" &&
      normalizeCode_(row.Status || "ACTIVE") !== "DELETED" &&
      String(row.ExternalEventId || "") === String(originalEvent.EventId || "");
  });
  const points = credit ? Number(credit.Points || 0) : 0;
  if (!(points > 0)) return { ledgerId: "", points: 0 };
  const ledgerId = "MCP_MTS_REV_" + Utilities.getUuid();
  appendObjectRow_(sheet, {
    ID: ledgerId, UserEmail: originalEvent.UserEmail, Points: -points, EntryType: "REVERSAL",
    ReasonCode: String(credit.ReasonCode || "ACTIVITY") + "_REVERSAL",
    ReasonName: "Đảo điểm do xóa hoạt động", Source: METTASOUL_INTEGRATION_SCHEMA_.source,
    ExternalEventId: cancellationEventId, ActivityId: originalEvent.ScheduleId,
    AssignmentId: originalEvent.PeriodId, WorkDate: credit.WorkDate, EvidenceUrl: "",
    Status: "Active", CreatedAt: new Date(), UpdatedAt: new Date()
  });
  return { ledgerId: ledgerId, points: -points };
}

function findConfirmedActivityIntegrationEvent_(ss, payload, targetKey) {
  const rows = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.events));
  const workLogId = String(payload && payload.workLogId || "").trim();
  const integrationEventId = String(payload && payload.integrationEventId || "").trim();
  const activityId = String(payload && payload.activityId || "").trim();
  const assignmentId = String(payload && payload.assignmentId || "").trim();
  const matches = rows.filter(function(row) {
    if (normalizeCode_(row.Status) !== "CONFIRMED" || normalizeCode_(row.Action) !== "SUBMIT_ACTIVITY_COMPLETION") return false;
    if (String(row.IdempotencyKey || "") === String(targetKey || "")) return true;
    if (workLogId && String(row.WorkLogId || "") === workLogId) return true;
    if (integrationEventId && String(row.EventId || "") === integrationEventId) return true;
    return Boolean(activityId && assignmentId) &&
      String(row.ScheduleId || "") === activityId && String(row.PeriodId || "") === assignmentId;
  });
  return matches.length ? matches[matches.length - 1] : null;
}

function cancelTeachingPeriod_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (error) {
    throw integrationError_("SYSTEM_BUSY", "HRM đang xử lý yêu cầu khác, vui lòng thử lại.");
  }
  try {
    const ss = getDatabase_();
    assertIntegrationReady_(ss);
    const targetKey = String(payload.targetIdempotencyKey || "").trim();
    const eventId = String(payload.eventId || "").trim();
    if (!targetKey || !eventId) throw integrationError_("INVALID_CANCEL_REQUEST", "Thiếu khóa dòng công cần hủy.");
    const original = findIntegrationEventByKey_(ss, targetKey);
    if (!original || normalizeCode_(original.Status) !== "CONFIRMED") {
      throw integrationError_("WORKLOG_NOT_FOUND", "Không tìm thấy dòng công đang hiệu lực.");
    }
    const existingCancellation = findIntegrationEventByKey_(ss, "CANCEL:" + targetKey);
    const cancellationEventId = existingCancellation && existingCancellation.EventId
      ? String(existingCancellation.EventId)
      : eventId;
    const workDate = findTeachingWorkLogDate_(ss, original);
    if (workDate && checkIsLocked_(workDate.slice(0, 7))) {
      throw integrationError_("PAYROLL_LOCKED", "Tháng chứa dòng công đã khóa sổ.");
    }
    const workLogCancellation = markTeachingWorkLogsDeleted_(ss, original);
    const mcpReversal = reverseTeachingContextMcp_(ss, original, cancellationEventId);
    const response = {
      ok: true,
      code: workLogCancellation.changedIds.length ? "WORKLOG_CANCELLED" : "WORKLOG_ALREADY_ABSENT",
      eventId: cancellationEventId,
      targetIdempotencyKey: targetKey,
      workLogId: original.WorkLogId,
      workLogWasPresent: workLogCancellation.matchedIds.length > 0,
      matchedWorkLogIds: workLogCancellation.matchedIds,
      cancelledWorkLogIds: workLogCancellation.changedIds,
      mcpReversalPoints: mcpReversal.points,
      mcpReversalLedgerId: mcpReversal.ledgerId,
      idempotent: Boolean(existingCancellation && normalizeCode_(existingCancellation.Status) === "CONFIRMED")
    };
    upsertIntegrationEvent_(ss, {
      EventId: cancellationEventId,
      IdempotencyKey: "CANCEL:" + targetKey,
      Action: "CANCEL_TEACHING_PERIOD",
      Source: METTASOUL_INTEGRATION_SCHEMA_.source,
      PayloadHash: payloadHash,
      Status: "CONFIRMED",
      WorkLogId: original.WorkLogId,
      UserEmail: original.UserEmail,
      ScheduleId: original.ScheduleId,
      PeriodId: original.PeriodId,
      ResponseJson: JSON.stringify(response),
      ErrorMessage: ""
    });
    return response;
  } finally {
    lock.releaseLock();
  }
}

function normalizeTeachingPeriodPayload_(payload) {
  const roleCode = normalizeCode_(payload.roleCode);
  if (["MAIN_TEACHER", "CO_TEACHER", "ASSISTANT"].indexOf(roleCode) === -1) {
    throw integrationError_("INVALID_ROLE", "Vai trò trong tiết dạy không hợp lệ.");
  }
  const result = {
    eventId: String(payload.eventId || "").trim(),
    idempotencyKey: String(payload.idempotencyKey || "").trim(),
    scheduleId: String(payload.scheduleId || "").trim(),
    periodId: String(payload.periodId || "").trim(),
    userEmail: String(payload.userEmail || "").trim().toLowerCase(),
    roleCode: roleCode,
    schoolId: String(payload.schoolId || "").trim(),
    schoolName: String(payload.schoolName || "").trim(),
    environmentCode: String(payload.environmentCode || "").trim().toLowerCase(),
    environmentName: String(payload.environmentName || "").trim(),
    classId: String(payload.classId || "").trim(),
    className: String(payload.className || "").trim(),
    workDate: String(payload.workDate || "").trim(),
    periodStartAt: String(payload.periodStartAt || "").trim(),
    periodEndAt: String(payload.periodEndAt || "").trim(),
    activityTypeCode: normalizeCode_(payload.activityTypeCode),
    evidenceUrl: String(payload.evidenceUrl || "").trim(),
    approvedBy: String(payload.approvedBy || "").trim(),
    principalCount: Number(payload.principalCount || 0),
    policyContract: String(payload.policyContract || "")
  };
  const required = ["eventId", "scheduleId", "periodId", "userEmail", "schoolId", "environmentCode", "workDate", "periodEndAt"];
  required.forEach(function(key) {
    if (!result[key]) throw integrationError_("MISSING_FIELD", "Thiếu trường bắt buộc: " + key);
  });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.workDate)) {
    throw integrationError_("INVALID_WORK_DATE", "Ngày dạy phải có định dạng yyyy-MM-dd.");
  }
  if (!result.idempotencyKey) {
    result.idempotencyKey = [result.scheduleId, result.periodId, result.userEmail, result.roleCode].join(":");
  }
  return result;
}

function calculateTeachingPeriodPay_(ss, input, profile) {
  const isAssistant = input.roleCode === "ASSISTANT";
  const studentOutsideTopic = isAssistant && normalizeCode_(profile.WorkerCategory) === "STUDENT_ASSISTANT";
  const baseRate = studentOutsideTopic ? 0 : toNonNegativeNumber_(profile.BaseRate, "Đơn giá cơ bản");
  const durationMinutes = getTeachingPeriodDurationMinutes_(input.periodStartAt, input.periodEndAt);
  const payMultiplier = DOUBLE_PAY_DURATION_MINUTES_.indexOf(durationMinutes) >= 0 ? 2 : 1;
  let schoolAllowance = 0;
  let environmentAllowance = 0;
  let managementAllowance = 0;
  let schoolContext;

  if (!isAssistant) {
    schoolContext = requireTeachingContextRate_(ss, "SCHOOL", input.schoolId, input.workDate);
    const environmentContext = requireTeachingContextRate_(ss, "ENVIRONMENT", input.environmentCode, input.workDate);
    if (toBoolean_(profile.AllowContextRates)) {
      schoolAllowance = toNonNegativeNumber_(schoolContext.Amount, "Phụ cấp trường");
      environmentAllowance = toNonNegativeNumber_(environmentContext.Amount, "Phụ cấp môi trường");
    }
    if (userHasTag_(ss, input.userEmail, "MANAGER")) {
      managementAllowance = toNonNegativeNumber_(profile.ManagementAllowance, "Phụ cấp Ban Quản lý");
    }
  } else {
    // Assistants do not need a cash context rate, but an optional school row
    // can still grant the configured MCP without blocking ordinary schools.
    schoolContext = findTeachingContextRate_(ss, "SCHOOL", input.schoolId, input.workDate) || {};
  }

  const subtotal = baseRate + schoolAllowance + environmentAllowance + managementAllowance;
  const total = Math.round(subtotal * payMultiplier);
  return {
    quantity: 1,
    unit: String(profile.Unit || "Tiết"),
    baseRate: baseRate,
    schoolAllowance: schoolAllowance,
    environmentAllowance: environmentAllowance,
    managementAllowance: managementAllowance,
    durationMinutes: durationMinutes,
    payMultiplier: payMultiplier,
    mcpPoints: isFarSchoolMcpContext_(schoolContext) ? TEACHING_MCP_PER_PERIOD_ * payMultiplier : 0,
    total: total,
    profileCode: String(profile.Code || ""),
    profileId: String(profile.ID || ""),
    policyVersion: "PROFILE:" + String(profile.Version || 1) + ";MCP:FAR_SCHOOLS_ONLY;SCHEMA:" + METTASOUL_INTEGRATION_SCHEMA_.version
  };
}

function getTeachingPeriodDurationMinutes_(periodStartAt, periodEndAt) {
  const start = new Date(periodStartAt);
  const end = new Date(periodEndAt);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end.getTime() <= start.getTime()) return 0;
  return Math.round((end.getTime() - start.getTime()) / 60000);
}

function isFarSchoolMcpContext_(schoolContext) {
  const schoolCode = normalizeCode_(schoolContext && schoolContext.ExternalCode);
  return FAR_SCHOOL_MCP_CODES_.indexOf(schoolCode) >= 0;
}

/** MCP is limited to configured far-school contexts; 90/95-minute periods use x2. */
function awardTeachingContextMcp_(ss, input, calculation) {
  const points = toNonNegativeNumber_(calculation.mcpPoints, "Điểm MCP tiết dạy");
  if (!points) return "";
  const ledgerId = "MCP_MTS_" + input.eventId;
  if (readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger)).some(function(row) { return String(row.ID) === ledgerId; })) return ledgerId;
  appendObjectRow_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger), {
    ID: ledgerId, UserEmail: input.userEmail, Points: points, EntryType: "CREDIT",
    ReasonCode: "TEACHING_PERIOD", ReasonName: calculation.activityTypeCode ? "MCP chuyên đề và trường xa" : "MCP tiết dạy",
    Source: METTASOUL_INTEGRATION_SCHEMA_.source, ExternalEventId: input.eventId,
    ActivityId: input.scheduleId, AssignmentId: input.periodId, WorkDate: input.workDate,
    EvidenceUrl: input.evidenceUrl || "", Status: "Active", CreatedAt: new Date(), UpdatedAt: new Date()
  });
  return ledgerId;
}

/** Preserve an auditable append-only ledger: cancellation offsets the credit. */
function reverseTeachingContextMcp_(ss, originalEvent, cancellationEventId) {
  const sheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger);
  const originalEventId = String(originalEvent.EventId || "");
  const ledgerRows = readSheetObjects_(sheet);
  const existingReversal = ledgerRows.find(function(row) {
    return String(row.ExternalEventId || "") === String(cancellationEventId || "") &&
      normalizeCode_(row.EntryType) === "REVERSAL";
  });
  if (existingReversal) {
    return {
      ledgerId: String(existingReversal.ID || ""),
      points: Number(existingReversal.Points || 0)
    };
  }
  const points = ledgerRows.filter(function(row) {
    return String(row.ExternalEventId || "") === originalEventId &&
      isTeachingMcpReason_(row.ReasonCode) && normalizeCode_(row.Status || "ACTIVE") !== "DELETED";
  }).reduce(function(total, row) { return total + Number(row.Points || 0); }, 0);
  if (!points) return { ledgerId: "", points: 0 };
  const ledgerId = "MCP_MTS_REV_" + Utilities.getUuid();
  appendObjectRow_(sheet, {
    ID: ledgerId, UserEmail: originalEvent.UserEmail, Points: -points, EntryType: "REVERSAL",
    ReasonCode: "TEACHING_PERIOD_REVERSAL", ReasonName: "Đảo MCP do hủy tiết dạy/trợ giảng",
    Source: METTASOUL_INTEGRATION_SCHEMA_.source, ExternalEventId: cancellationEventId,
    ActivityId: originalEvent.ScheduleId, AssignmentId: originalEvent.PeriodId,
    WorkDate: findWorkLogDate_(ss, originalEvent.WorkLogId), EvidenceUrl: "", Status: "Active",
    CreatedAt: new Date(), UpdatedAt: new Date()
  });
  return { ledgerId: ledgerId, points: -points };
}

function isTeachingMcpReason_(reasonCode) {
  const code = normalizeCode_(reasonCode);
  return code === "TEACHING_PERIOD" || code === "TEACHING_FAR_SCHOOL" || code === "TEACHING_POLICY_ADJUSTMENT";
}

/**
 * One-time, repeat-safe correction for completed teaching periods on a date.
 * It keeps the existing WorkLog IDs, updates their HRM calculation snapshots,
 * and appends only the missing MCP delta to the immutable ledger.
 */
function repairTeachingPolicyForDate_(workDate) {
  const date = String(workDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw integrationError_("INVALID_WORK_DATE", "Ngày điều chỉnh phải có định dạng yyyy-MM-dd.");
  if (checkIsLocked_(date.slice(0, 7))) throw integrationError_("PAYROLL_LOCKED", "Tháng " + date.slice(0, 7) + " đã khóa sổ.");

  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (error) { throw integrationError_("SYSTEM_BUSY", "HRM đang xử lý yêu cầu khác, vui lòng thử lại."); }
  try {
    const ss = getDatabase_();
    setupMettasoulIntegration_();
    const events = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.events));
    const activeEvents = events.filter(function(event) {
      return normalizeCode_(event.Action) === "SUBMIT_TEACHING_PERIOD" && normalizeCode_(event.Status) === "CONFIRMED";
    });
    const result = { workDate: date, examined: 0, adjustedWorkLogs: 0, adjustedMcpEntries: 0, totalMcpDelta: 0, skipped: [] };
    activeEvents.forEach(function(event) {
      const workLog = readWorkLogObjects_(ss).find(function(row) { return teachingWorkLogMatchesEvent_(row, event); });
      if (!workLog || teachingWorkLogDate_(workLog, event.CreatedAt) !== date || normalizeCode_(workLog.Status) === "DELETED") return;
      result.examined++;
      try {
        const input = teachingInputFromWorkLog_(workLog, event);
        let calculation;
        try {
          const profile = resolveTeachingPayProfile_(ss, resolvePayAssignment_(ss, input.userEmail, input.workDate), input.roleCode, input.workDate);
          calculation = calculateTeachingPeriodPay_(ss, input, profile);
        } catch (calculationError) {
          calculation = legacyTeachingPolicyCalculation_(input, event, calculationError);
        }
        if (updateTeachingWorkLogPolicySnapshot_(ss, workLog, calculation)) result.adjustedWorkLogs++;
        const currentMcp = activeTeachingMcpForEvent_(ss, event.EventId);
        const delta = calculation.mcpPoints - currentMcp;
        if (delta) {
          appendObjectRow_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger), {
            ID: "MCP_MTS_POLICY_" + Utilities.getUuid(), UserEmail: input.userEmail, Points: delta, EntryType: "ADJUSTMENT",
            ReasonCode: "TEACHING_POLICY_ADJUSTMENT", ReasonName: "Điều chỉnh MCP tiết dạy theo chính sách hiện hành",
            Source: METTASOUL_INTEGRATION_SCHEMA_.source, ExternalEventId: event.EventId,
            ActivityId: input.scheduleId, AssignmentId: input.periodId, WorkDate: input.workDate,
            EvidenceUrl: "", Status: "Active", CreatedAt: new Date(), UpdatedAt: new Date()
          });
          result.adjustedMcpEntries++;
          result.totalMcpDelta += delta;
        }
        updateTeachingIntegrationEventResponse_(ss, event, calculation);
      } catch (error) {
        result.skipped.push({ workLogId: String(workLog.ID || ""), reason: error && error.message ? error.message : String(error) });
      }
    });
    return result;
  } finally { lock.releaseLock(); }
}

/** Operator shortcut for the completed-teaching correction of the prior day. */
function repairYesterdayTeachingPolicy_() {
  const timezone = Session.getScriptTimeZone();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return repairTeachingPolicyForDate_(Utilities.formatDate(yesterday, timezone, "yyyy-MM-dd"));
}

/**
 * Administrator-safe audit of a single day.  It makes no writes and is kept
 * as an operational check for the HRM teaching-pay policy.
 */
function auditTeachingPayForDate_(workDate) {
  const date = String(workDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw integrationError_("INVALID_WORK_DATE", "Ngày kiểm tra phải có định dạng yyyy-MM-dd.");
  const ss = getDatabase_();
  const managers = readSheetObjects_(ss.getSheetByName("Users"))
    .filter(function(user) { return userHasTag_(ss, String(user.Email || ""), "MANAGER"); })
    .map(function(user) { return { email: String(user.Email || ""), name: String(user.Name || ""), tags: String(user.Tags || "") }; });
  const events = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.events));
  const workLogs = readWorkLogObjects_(ss);
  const rows = events.filter(function(event) {
    return normalizeCode_(event.Action) === "SUBMIT_TEACHING_PERIOD" && normalizeCode_(event.Status) === "CONFIRMED";
  }).map(function(event) {
    const workLog = workLogs.find(function(row) { return teachingWorkLogMatchesEvent_(row, event); });
    if (!workLog || teachingWorkLogDate_(workLog, event.CreatedAt) !== date || normalizeCode_(workLog.Status) === "DELETED") return null;
    const input = teachingInputFromWorkLog_(workLog, event);
    const profile = resolveTeachingPayProfile_(ss, resolvePayAssignment_(ss, input.userEmail, input.workDate), input.roleCode, input.workDate);
    const calculation = calculateTeachingPeriodPay_(ss, input, profile);
    return { workLogId: String(workLog.ID || ""), userEmail: input.userEmail, schoolId: input.schoolId, schoolName: input.schoolName, durationMinutes: calculation.durationMinutes, moneyStored: Number(workLog.Money || 0), mcpStored: Number((safeParseJson_(workLog.InputData || workLog.InputData_JSON, {}).calculation || {}).mcpPoints || 0), moneyExpected: calculation.total, mcpExpected: calculation.mcpPoints, managementAllowance: calculation.managementAllowance, isManager: userHasTag_(ss, input.userEmail, "MANAGER") };
  }).filter(function(row) { return row; });
  return { workDate: date, managers: managers, rows: rows };
}

/** Public read-only audit for the requested completed-teaching date. */
function auditTeachingPayFor20260923() {
  const result = auditTeachingPayForDate_("2026-09-23");
  Logger.log(JSON.stringify(result));
  return result;
}

/** Public, idempotent operator action for the current policy on 23 Sep 2026. */
function repairTeachingPayFor20260923() {
  return repairTeachingPolicyForDate_("2026-09-23");
}

/**
 * Applies the approved 10,000 VND management allowance to every professional
 * teaching profile, then reconciles the affected completed periods.  Manager
 * eligibility remains the HRM Users.Tags value `MANAGER`.
 */
function applyManagementAllowance10kAndRepair20260923() {
  const actorEmail = "paultran190521@gmail.com";
  const ss = getDatabase_();
  const profiles = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles));
  const applied = [];
  ["TEACHER_A", "TEACHER_B", "TEACHER_C"].forEach(function(code) {
    const profile = profiles.find(function(row) { return normalizeCode_(row.Code) === code; });
    if (!profile) throw integrationError_("PAY_PROFILE_MISSING", "Thiếu hồ sơ đơn giá " + code + ".");
    if (Number(profile.ManagementAllowance || 0) !== 10000) {
      profile.ManagementAllowance = 10000;
      saveTeachingPayProfile_(profile, actorEmail);
      applied.push(code);
    }
  });
  const repair = repairTeachingPolicyForDate_("2026-09-23");
  Logger.log(JSON.stringify({ managementAllowance: 10000, profilesUpdated: applied, repair: repair }));
  return { managementAllowance: 10000, profilesUpdated: applied, repair: repair };
}

function teachingInputFromWorkLog_(workLog, event) {
  const data = safeParseJson_(workLog.InputData || workLog.InputData_JSON, {});
  const integration = data.integration || {};
  return normalizeTeachingPeriodPayload_({
    eventId: event.EventId, idempotencyKey: event.IdempotencyKey, scheduleId: event.ScheduleId || integration.scheduleId,
    periodId: event.PeriodId || integration.periodId, userEmail: event.UserEmail || workLog.UserEmail,
    roleCode: workLog.RoleCode || integration.roleCode || "MAIN_TEACHER", schoolId: (data.school && data.school.id) || data.schoolId || "LEGACY",
    schoolName: (data.school && data.school.name) || data.schoolName || "LEGACY", environmentCode: (data.environment && data.environment.code) || data.environmentCode || "in_class",
    environmentName: (data.environment && data.environment.name) || data.environmentName || "Trong lớp", classId: (data.classRoom && data.classRoom.id) || data.classId || "LEGACY",
    className: (data.classRoom && data.classRoom.name) || data.className || "LEGACY", workDate: teachingWorkLogDate_(workLog, event.CreatedAt),
    periodStartAt: data.periodStartAt || legacyPeriodTimestamp_(teachingWorkLogDate_(workLog, event.CreatedAt), data.startTime),
    periodEndAt: data.periodEndAt || legacyPeriodTimestamp_(teachingWorkLogDate_(workLog, event.CreatedAt), data.endTime)
  });
}

function teachingWorkLogDate_(workLog, fallbackDate) {
  const storedDate = safeDateStr_(workLog.Date || workLog.DateLog, "yyyy-MM-dd");
  if (storedDate) return storedDate;
  const data = safeParseJson_(workLog.InputData || workLog.InputData_JSON, {});
  const legacyDate = safeDateStr_(data.workDate || data.ngay_day, "yyyy-MM-dd");
  if (legacyDate) return legacyDate;
  if (data.periodStartAt) return safeDateStr_(new Date(data.periodStartAt), "yyyy-MM-dd");
  return safeDateStr_(fallbackDate, "yyyy-MM-dd");
}

function legacyPeriodTimestamp_(workDate, time) {
  const value = String(time || "").trim();
  return /^\d{2}:\d{2}$/.test(value) && /^\d{4}-\d{2}-\d{2}$/.test(String(workDate || ""))
    ? String(workDate) + "T" + value + ":00+07:00"
    : "";
}

// Legacy 2026 records were created before the HRM WorkLogs sheet carried the
// normalized school/context fields.  Their original HRM-confirmed amount is
// still authoritative; use it only to apply the newly approved duration rule.
function legacyTeachingPolicyCalculation_(input, event, originalError) {
  const durationMinutes = getTeachingPeriodDurationMinutes_(input);
  if (DOUBLE_PAY_DURATION_MINUTES_.indexOf(durationMinutes) < 0) throw originalError;
  const previous = safeParseJson_(event.ResponseJson, {});
  const previousMoney = Number(previous.money || 0);
  if (!previousMoney) throw originalError;
  return {
    total: Math.round(previousMoney * 2),
    // A legacy record without an HRM school context cannot prove that it was
    // taught at a far school, so it never receives a retroactive MCP award.
    mcpPoints: 0,
    durationMinutes: durationMinutes,
    payMultiplier: 2,
    policyVersion: "TEACHING_PERIOD_POLICY:LEGACY_DURATION_RECONCILIATION"
  };
}

function updateTeachingWorkLogPolicySnapshot_(ss, workLog, calculation) {
  const sheet = ss.getSheetByName("WorkLogs");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const rowIndex = values.slice(1).findIndex(function(row) {
    const candidate = workLogObjectFromValues_(headers, row);
    return (String(candidate.ID || "") && String(candidate.ID || "") === String(workLog.ID || "")) ||
      (String(candidate.ExternalEventId || "") && String(candidate.ExternalEventId || "") === String(workLog.ExternalEventId || ""));
  });
  if (rowIndex < 0) return false;
  const row = rowIndex + 2;
  const inputIndex = headers.indexOf("InputData") >= 0 ? headers.indexOf("InputData") : headers.indexOf("InputData_JSON");
  const input = inputIndex >= 0 ? safeParseJson_(values[rowIndex + 1][inputIndex], {}) : {};
  input.calculation = calculation;
  writeIntegratedTeachingWorkLog_(sheet, row, Object.assign({}, workLog, {
    ID: workLog.ID || workLog.LogID,
    LogID: workLog.ID || workLog.LogID,
    TaskId: workLog.TaskId || workLog.TaskID,
    TaskID: workLog.TaskId || workLog.TaskID,
    InputData: JSON.stringify(input),
    InputData_JSON: JSON.stringify(input),
    Quantity: calculation.quantity || 1,
    Money: calculation.total,
    TotalMoney: calculation.total,
    Date: workLog.Date || workLog.DateLog,
    DateLog: workLog.Date || workLog.DateLog,
    Status: "Active",
    Source: workLog.Source || METTASOUL_INTEGRATION_SCHEMA_.source,
    UpdatedAt: new Date()
  }));
  return true;
}

function activeTeachingMcpForEvent_(ss, eventId) {
  return readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger)).filter(function(row) {
    return String(row.ExternalEventId || "") === String(eventId || "") && isTeachingMcpReason_(row.ReasonCode) && normalizeCode_(row.Status || "ACTIVE") !== "DELETED";
  }).reduce(function(total, row) { return total + Number(row.Points || 0); }, 0);
}

function updateTeachingIntegrationEventResponse_(ss, event, calculation) {
  const sheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.events);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const responseIndex = headers.indexOf("ResponseJson");
  const updatedAtIndex = headers.indexOf("UpdatedAt");
  const eventIndex = values.slice(1).findIndex(function(row) { return String(row[headers.indexOf("EventId")] || "") === String(event.EventId || ""); });
  if (eventIndex < 0) return;
  const response = safeParseJson_(values[eventIndex + 1][responseIndex], {});
  response.money = calculation.total;
  response.mcpPoints = calculation.mcpPoints;
  response.policyVersion = calculation.policyVersion;
  sheet.getRange(eventIndex + 2, responseIndex + 1).setValue(JSON.stringify(response));
  if (updatedAtIndex >= 0) sheet.getRange(eventIndex + 2, updatedAtIndex + 1).setValue(new Date());
}

function resolvePayAssignment_(ss, userEmail, workDate) {
  const rows = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.assignments));
  const found = rows.find(function(row) {
    return String(row.UserEmail || "").trim().toLowerCase() === userEmail && isEffectiveRow_(row, workDate);
  });
  if (!found) throw integrationError_("PAY_ASSIGNMENT_MISSING", "Giáo viên chưa được gán hồ sơ đơn giá HRM.");
  return found;
}

function resolveTeachingPayProfile_(ss, assignment, roleCode, workDate) {
  let code = String(assignment.DefaultProfileCode || "").trim();
  if (roleCode === "ASSISTANT") {
    code = String(assignment.AssistantProfileCode || "").trim();
    if (!code) {
      code = normalizeCode_(assignment.WorkerCategory) === "STUDENT_ASSISTANT"
        ? "ASSISTANT_STUDENT"
        : "ASSISTANT_PRO";
    }
  }
  if (!code) throw integrationError_("PAY_PROFILE_MISSING", "Chưa xác định được hồ sơ đơn giá cho vai trò này.");
  const rows = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles));
  const found = rows.find(function(row) {
    const roles = String(row.AppliesToRoles || "").split(",").map(normalizeCode_);
    return normalizeCode_(row.Code) === normalizeCode_(code) && roles.indexOf(roleCode) >= 0 && isEffectiveRow_(row, workDate);
  });
  if (!found) throw integrationError_("PAY_PROFILE_NOT_EFFECTIVE", "Hồ sơ đơn giá không tồn tại hoặc chưa có hiệu lực cho vai trò này.");
  return found;
}

function requireTeachingContextRate_(ss, contextType, externalCode, workDate) {
  const found = findTeachingContextRate_(ss, contextType, externalCode, workDate);
  if (!found) {
    throw integrationError_("CONTEXT_RATE_MISSING", "HRM chưa cấu hình phụ cấp cho " + contextType + ": " + externalCode);
  }
  return found;
}

function findTeachingContextRate_(ss, contextType, externalCode, workDate) {
  const rows = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.contexts));
  return rows.find(function(row) {
    return normalizeCode_(row.ContextType) === normalizeCode_(contextType) &&
      String(row.ExternalCode || "").trim().toLowerCase() === String(externalCode || "").trim().toLowerCase() &&
      isEffectiveRow_(row, workDate);
  }) || null;
}

function appendIntegratedWorkLog_(ss, workLogId, task, input, profile, calculation) {
  const sheet = ss.getSheetByName("WorkLogs");
  const inputData = {
    integration: {
      source: METTASOUL_INTEGRATION_SCHEMA_.source,
      eventId: input.eventId,
      idempotencyKey: input.idempotencyKey,
      scheduleId: input.scheduleId,
      periodId: input.periodId,
      roleCode: input.roleCode
    },
    school: { id: input.schoolId, name: input.schoolName },
    environment: { code: input.environmentCode, name: input.environmentName },
    classRoom: { id: input.classId, name: input.className },
    periodStartAt: input.periodStartAt,
    periodEndAt: input.periodEndAt,
    activity: { typeCode: input.activityTypeCode || "", evidenceUrl: input.evidenceUrl || "", approvedBy: input.approvedBy || "" },
    calculation: calculation
  };
  writeIntegratedTeachingWorkLog_(sheet, sheet.getLastRow() + 1, {
    ID: workLogId,
    LogID: workLogId,
    UserEmail: input.userEmail,
    TaskId: task.id,
    TaskID: task.id,
    TaskName: calculation.activityName || task.name,
    InputData: JSON.stringify(inputData),
    InputData_JSON: JSON.stringify(inputData),
    Quantity: 1,
    Money: calculation.total,
    TotalMoney: calculation.total,
    Timestamp: new Date(),
    Date: input.workDate,
    DateLog: input.workDate,
    Status: "Active",
    Source: METTASOUL_INTEGRATION_SCHEMA_.source,
    ExternalEventId: input.eventId,
    ScheduleId: input.scheduleId,
    PeriodId: input.periodId,
    RoleCode: input.roleCode,
    PolicyVersion: calculation.policyVersion,
    RateProfileId: profile.ID,
    CalculationJson: JSON.stringify(calculation),
    ExternalStatus: "CONFIRMED",
    UpdatedAt: new Date()
  });
}

/**
 * WorkLogs is a legacy ten-column sheet.  Its visible labels vary between
 * deployments (for example LogID/ID and CalculatedValue/Quantity), so an
 * object-to-header append can silently leave payroll fields blank.  Write the
 * stable legacy positions as a fallback and then verify the payroll minimum.
 */
function writeIntegratedTeachingWorkLog_(sheet, rowNumber, record) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const values = rowNumber <= sheet.getLastRow()
    ? sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]
    : headers.map(function() { return ""; });
  const put = function(names, legacyIndex, value) {
    const index = names.map(function(name) { return headers.indexOf(name); }).find(function(index) { return index >= 0; });
    values[index >= 0 ? index : legacyIndex] = value;
  };
  put(["ID", "LogID"], 0, record.ID || record.LogID);
  put(["UserEmail"], 1, record.UserEmail);
  put(["TaskId", "TaskID"], 2, record.TaskId || record.TaskID);
  put(["TaskName"], 3, record.TaskName);
  put(["InputData", "InputData_JSON"], 4, record.InputData || record.InputData_JSON);
  put(["Quantity", "CalculatedValue"], 5, record.Quantity);
  put(["Money", "TotalMoney"], 6, record.Money || record.TotalMoney);
  put(["Timestamp"], 7, record.Timestamp);
  put(["Date", "DateLog"], 8, record.Date || record.DateLog);
  put(["Status"], 9, record.Status);
  put(["Source"], 10, record.Source);
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);

  const saved = sheet.getRange(rowNumber, 1, 1, Math.min(headers.length, 11)).getValues()[0];
  if (!String(saved[0] || "").trim() || !String(saved[2] || "").trim() ||
      saved[6] === "" || !isFinite(Number(saved[6])) || !toYmd_(saved[8]) || normalizeCode_(saved[9]) !== "ACTIVE") {
    throw integrationError_("WORKLOG_WRITE_INCOMPLETE", "HRM không thể ghi đủ dữ liệu lương cho tiết dạy; sự kiện không được xác nhận.");
  }
}

/**
 * One-time, idempotent recovery for the two 90-minute completed periods on
 * 2026-09-23 that were written by the former partial-row path.  The source
 * events and their assigned WorkLog IDs are verified before any row is fixed.
 */
function repairSeptember23MettasoulTeachingWorkLogs() {
  const workDate = "2026-09-23";
  if (checkIsLocked_(workDate.slice(0, 7))) throw integrationError_("PAYROLL_LOCKED", "Tháng 2026-09 đã khóa sổ.");
  const ss = getDatabase_();
  const workLogSheet = ss.getSheetByName("WorkLogs");
  const eventSheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.events);
  const eventRows = readSheetObjects_(eventSheet);
  const repairs = [
    { eventId: "MTS_EVT_7b2b30266df1331c08eccf01", workLogId: "LOG_MTS_1e1b188e-3969-4961-ae6f-0449c3c482c3", timestamp: new Date("2026-09-23T14:43:10+07:00") },
    { eventId: "MTS_EVT_7d768745f00da2ff2223f2a1", workLogId: "LOG_MTS_91d0427a-40f5-450d-be7f-ee8efe9efb49", timestamp: new Date("2026-09-23T22:15:37+07:00") }
  ];
  const rows = workLogSheet.getDataRange().getValues();
  const headers = rows[0].map(String);
  const incompleteRows = rows.slice(1).map(function(row, index) { return { row: row, rowNumber: index + 2 }; }).filter(function(item) {
    return !String(item.row[0] || "").trim() &&
      String(item.row[1] || "").trim().toLowerCase() === "paulvanthien@gmail.com" &&
      normalizeCode_(item.row[10]) === METTASOUL_INTEGRATION_SCHEMA_.source &&
      !toYmd_(item.row[8]) && String(item.row[3] || "").indexOf("Giảng dạy METTASOUL") >= 0;
  });
  if (incompleteRows.length !== repairs.length) throw integrationError_("LEGACY_ROWS_NOT_FOUND", "Không tìm thấy đúng hai dòng công thiếu dữ liệu để khôi phục.");

  repairs.forEach(function(repair, index) {
    const event = eventRows.find(function(row) { return String(row.EventId || "") === repair.eventId; });
    if (!event || normalizeCode_(event.Action) !== "SUBMIT_TEACHING_PERIOD" || normalizeCode_(event.Status) !== "CONFIRMED" || String(event.WorkLogId || "") !== repair.workLogId) {
      throw integrationError_("LEGACY_EVENT_MISMATCH", "Sự kiện chấm công lịch sử không khớp, không thể tự khôi phục.");
    }
    const input = {
      eventId: repair.eventId, idempotencyKey: event.IdempotencyKey, scheduleId: event.ScheduleId, periodId: event.PeriodId,
      userEmail: "paulvanthien@gmail.com", roleCode: "MAIN_TEACHER", workDate: workDate,
      schoolId: "s-37dc2c0f", schoolName: "TRƯỜNG THPT THỦ ĐỨC", classId: "", className: "",
      environmentCode: "in_class", environmentName: "Trong lớp",
      periodStartAt: "2026-09-23T00:00:00+07:00", periodEndAt: "2026-09-23T01:30:00+07:00"
    };
    const assignment = resolvePayAssignment_(ss, input.userEmail, workDate);
    const profile = resolveTeachingPayProfile_(ss, assignment, input.roleCode, workDate);
    const calculation = calculateTeachingPeriodPay_(ss, input, profile);
    if (calculation.total !== 330000 || calculation.mcpPoints !== 0) throw integrationError_("LEGACY_CALCULATION_MISMATCH", "Kết quả khôi phục không đúng 330.000đ và 0 MCP.");
    const task = getAuthoritativeTaskById_(ss, getMettasoulIntegrationTaskId_(ss));
    const inputData = {
      integration: { source: METTASOUL_INTEGRATION_SCHEMA_.source, eventId: input.eventId, idempotencyKey: input.idempotencyKey, scheduleId: input.scheduleId, periodId: input.periodId, roleCode: input.roleCode },
      school: { id: input.schoolId, name: input.schoolName }, environment: { code: input.environmentCode, name: input.environmentName },
      classRoom: { id: "", name: "" }, periodStartAt: input.periodStartAt, periodEndAt: input.periodEndAt, calculation: calculation
    };
    writeIntegratedTeachingWorkLog_(workLogSheet, incompleteRows[index].rowNumber, {
      ID: repair.workLogId, UserEmail: input.userEmail, TaskId: task.id, TaskName: task.name,
      InputData: JSON.stringify(inputData), Quantity: 1, Money: calculation.total,
      Timestamp: repair.timestamp, Date: workDate, Status: "Active", Source: METTASOUL_INTEGRATION_SCHEMA_.source
    });
    updateTeachingIntegrationEventResponse_(ss, event, calculation);
  });
  return { success: true, repairedWorkLogs: repairs.map(function(item) { return item.workLogId; }), money: 660000, mcpPoints: 0 };
}


function assertIntegrationReady_(ss) {
  const enabled = getMettasoulIntegrationEnabled_(ss);
  if (!enabled) throw integrationError_("INTEGRATION_DISABLED", "Tích hợp METTASOUL đang tắt.");
}

function assertPeriodEnded_(periodEndAt) {
  const end = new Date(periodEndAt);
  if (isNaN(end.getTime())) throw integrationError_("INVALID_PERIOD_END", "Thời gian kết thúc tiết không hợp lệ.");
  if (Date.now() < end.getTime()) throw integrationError_("PERIOD_NOT_ENDED", "Chỉ được chấm công sau khi tiết học kết thúc.");
}

function assertHrmUserExists_(ss, email) {
  const sheet = ss.getSheetByName("Users");
  const rows = readSheetObjects_(sheet);
  const found = rows.some(function(row) { return String(row.Email || "").trim().toLowerCase() === email; });
  if (!found) throw integrationError_("USER_NOT_MAPPED", "Email giáo viên chưa tồn tại trong HRM.");
}

function assertHrmAdmin_(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) throw integrationError_("ADMIN_REQUIRED", "Thiếu tài khoản quản trị.");
  const rows = readSheetObjects_(getDatabase_().getSheetByName("Users"));
  const admin = rows.find(function(row) {
    return String(row.Email || "").trim().toLowerCase() === normalized && normalizeCode_(row.Role) === "ADMIN";
  });
  if (!admin) throw integrationError_("FORBIDDEN", "Chỉ quản trị viên HRM được thay đổi cấu hình này.");
}

function getAuthoritativeTaskById_(ss, taskId) {
  const rows = readSheetObjects_(ss.getSheetByName("Tasks"));
  const row = rows.find(function(item) {
    return String(item.TaskID || item.ID || "") === String(taskId || "") && normalizeCode_(item.Status) !== "DELETED";
  });
  if (!row) throw integrationError_("TASK_NOT_FOUND", "Không tìm thấy công việc HRM được cấu hình.");
  return {
    id: row.TaskID || row.ID,
    groupId: row.GroupID || row.GroupId,
    name: row.TaskName || row.Name,
    unit: row.Unit,
    rate: Number(row.Rate) || 0,
    fields: row.DynamicFields_JSON || row.FieldsConfig || "[]",
    policyJson: row.Policy_JSON || row.PolicyJson || "{}"
  };
}

function assertProfileCodeConfigured_(ss, profileCode, requiredRoles) {
  const code = normalizeCode_(profileCode);
  const row = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles)).find(function(profile) {
    return normalizeCode_(profile.Code) === code && normalizeCode_(profile.Status) === "ACTIVE";
  });
  if (!row) throw integrationError_("PAY_PROFILE_NOT_FOUND", "Không tìm thấy hồ sơ đơn giá: " + profileCode);
  const roles = String(row.AppliesToRoles || "").split(",").map(normalizeCode_);
  const matches = requiredRoles.some(function(role) { return roles.indexOf(role) >= 0; });
  if (!matches) throw integrationError_("PAY_PROFILE_ROLE_MISMATCH", "Hồ sơ " + profileCode + " không áp dụng cho vai trò đã chọn.");
}

function userHasTag_(ss, email, tag) {
  const rows = readSheetObjects_(ss.getSheetByName("Users"));
  const normalizedEmail = String(email || "").trim().toLowerCase();
  // HRM legacy users use `Tags`, while the production Users sheet labels the
  // same field `UserTags`.  Payroll eligibility must accept both schemas.
  const user = rows.find(function(row) {
    return String(row.Email || row.UserEmail || "").trim().toLowerCase() === normalizedEmail;
  });
  const tags = user ? String(user.Tags || user.UserTags || "").toUpperCase() : "";
  return tags.split(/[,;|]/).map(function(value) { return value.trim(); }).indexOf(String(tag).toUpperCase()) >= 0;
}

function ensureIntegrationSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
    const missing = headers.filter(function(header) { return current.indexOf(header) === -1; });
    if (missing.length) sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
  }
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight("bold").setBackground("#e3f2fd");
  return sheet;
}

function ensureSystemConfigSheet_(ss) {
  return ensureIntegrationSheet_(ss, "SystemConfig", ["Key", "Value"]);
}

function ensureWorkLogIntegrationColumns_(ss) {
  const sheet = ss.getSheetByName("WorkLogs");
  if (!sheet) throw integrationError_("WORKLOG_SHEET_MISSING", "HRM chưa có bảng WorkLogs.");
  const current = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
  const missing = INTEGRATION_WORKLOG_HEADERS_.filter(function(header) { return current.indexOf(header) === -1; });
  if (missing.length) sheet.getRange(1, sheet.getLastColumn() + 1, 1, missing.length).setValues([missing]);
}

function readSheetObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value !== null; });
  }).map(function(row) {
    const object = {};
    headers.forEach(function(header, index) { object[header] = row[index]; });
    return object;
  });
}

function serializeSheetObject_(object) {
  const serialized = {};
  Object.keys(object || {}).forEach(function(key) {
    const value = object[key];
    serialized[key] = value instanceof Date
      ? Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ssXXX")
      : value;
  });
  return serialized;
}

function appendObjectRow_(sheet, object) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : "";
  }));
}

function appendObjectRows_(sheet, objects) {
  if (!objects || !objects.length) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const rows = objects.map(function(object) {
    return headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(object, header) ? object[header] : "";
    });
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

function versionedUpsert_(ss, sheetName, headers, input, uniqueField, entityType, actorEmail, idPrefix, extraMatch) {
  const sheet = ensureIntegrationSheet_(ss, sheetName, headers);
  const values = sheet.getDataRange().getValues();
  const currentHeaders = values[0].map(String);
  const idIndex = currentHeaders.indexOf("ID");
  const uniqueIndex = currentHeaders.indexOf(uniqueField);
  let rowIndex = -1;
  let previous = null;
  for (let i = 1; i < values.length; i++) {
    const rowObject = {};
    currentHeaders.forEach(function(header, index) { rowObject[header] = values[i][index]; });
    const idMatches = input.ID && String(values[i][idIndex]) === String(input.ID);
    const uniqueMatches = String(values[i][uniqueIndex] || "").trim().toLowerCase() === String(input[uniqueField] || "").trim().toLowerCase();
    if ((idMatches || uniqueMatches) && (!extraMatch || extraMatch(rowObject))) {
      rowIndex = i + 1;
      previous = rowObject;
      break;
    }
  }
  const now = new Date();
  const output = Object.assign({}, input);
  output.ID = previous ? previous.ID : (idPrefix + Utilities.getUuid());
  output.Version = previous ? (Number(previous.Version) || 0) + 1 : 1;
  output.UpdatedAt = now;
  output.UpdatedBy = actorEmail;
  const row = currentHeaders.map(function(header) {
    return Object.prototype.hasOwnProperty.call(output, header) ? output[header] : (previous ? previous[header] : "");
  });
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  appendPolicyVersion_(ss, entityType, output.ID, output.Version, output, previous ? "UPDATE" : "CREATE", actorEmail);
  return output;
}

function appendPolicyVersion_(ss, entityType, entityId, version, snapshot, changeType, actorEmail) {
  const sheet = ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.versions, TASK_POLICY_VERSION_HEADERS_);
  appendObjectRow_(sheet, {
    ID: "POL_" + Utilities.getUuid(),
    EntityType: entityType,
    EntityId: entityId,
    Version: version,
    SnapshotJson: JSON.stringify(snapshot),
    ChangeType: changeType,
    ChangedAt: new Date(),
    ChangedBy: actorEmail
  });
}

function normalizeTeachingPayProfile_(profile) {
  profile = profile || {};
  const code = normalizeCode_(profile.Code || profile.code);
  if (!code) throw integrationError_("PROFILE_CODE_REQUIRED", "Thiếu mã hồ sơ đơn giá.");
  const roles = String(profile.AppliesToRoles || profile.appliesToRoles || "").split(",").map(normalizeCode_).filter(Boolean);
  if (!roles.length) throw integrationError_("PROFILE_ROLE_REQUIRED", "Hồ sơ phải áp dụng cho ít nhất một vai trò.");
  roles.forEach(function(role) {
    if (["MAIN_TEACHER", "CO_TEACHER", "ASSISTANT"].indexOf(role) === -1) {
      throw integrationError_("INVALID_PROFILE_ROLE", "Vai trò hồ sơ không hợp lệ: " + role);
    }
  });
  const normalized = {
    ID: profile.ID || profile.id || "",
    Code: code,
    Name: String(profile.Name || profile.name || code).trim(),
    AppliesToRoles: roles.join(","),
    WorkerCategory: normalizeCode_(profile.WorkerCategory || profile.workerCategory || "PROFESSIONAL_TEACHER"),
    Unit: String(profile.Unit || profile.unit || "Tiết").trim(),
    BaseRate: toNonNegativeNumber_(profile.BaseRate !== undefined ? profile.BaseRate : profile.baseRate, "Đơn giá cơ bản"),
    ManagementAllowance: toNonNegativeNumber_(profile.ManagementAllowance !== undefined ? profile.ManagementAllowance : profile.managementAllowance, "Phụ cấp Ban Quản lý"),
    AllowContextRates: toBoolean_(profile.AllowContextRates !== undefined ? profile.AllowContextRates : profile.allowContextRates),
    EffectiveFrom: toDateCell_(profile.EffectiveFrom || profile.effectiveFrom),
    EffectiveTo: toDateCell_(profile.EffectiveTo || profile.effectiveTo),
    ConditionsJson: normalizeJsonText_(profile.ConditionsJson || profile.conditionsJson || "{}"),
    Status: normalizeStatus_(profile.Status || profile.status)
  };
  assertEffectiveDateRange_(normalized.EffectiveFrom, normalized.EffectiveTo);
  return normalized;
}

function normalizeTeachingContextRate_(contextRate) {
  contextRate = contextRate || {};
  const type = normalizeCode_(contextRate.ContextType || contextRate.contextType);
  if (["SCHOOL", "ENVIRONMENT"].indexOf(type) === -1) {
    throw integrationError_("INVALID_CONTEXT_TYPE", "Loại bối cảnh phải là SCHOOL hoặc ENVIRONMENT.");
  }
  const code = String(contextRate.ExternalCode || contextRate.externalCode || "").trim();
  if (!code) throw integrationError_("CONTEXT_CODE_REQUIRED", "Thiếu mã bối cảnh METTASOUL.");
  const normalized = {
    ID: contextRate.ID || contextRate.id || "",
    ContextType: type,
    ExternalCode: code,
    Name: String(contextRate.Name || contextRate.name || code).trim(),
    Amount: toNonNegativeNumber_(contextRate.Amount !== undefined ? contextRate.Amount : contextRate.amount, "Phụ cấp bối cảnh"),
    EffectiveFrom: toDateCell_(contextRate.EffectiveFrom || contextRate.effectiveFrom),
    EffectiveTo: toDateCell_(contextRate.EffectiveTo || contextRate.effectiveTo),
    McpPoints: toNonNegativeNumber_(contextRate.McpPoints !== undefined ? contextRate.McpPoints : contextRate.mcpPoints, "Điểm MCP bối cảnh"),
    Status: normalizeStatus_(contextRate.Status || contextRate.status)
  };
  assertEffectiveDateRange_(normalized.EffectiveFrom, normalized.EffectiveTo);
  return normalized;
}

function normalizePayProfileAssignment_(assignment) {
  assignment = assignment || {};
  const email = String(assignment.UserEmail || assignment.userEmail || "").trim().toLowerCase();
  if (!email || email.indexOf("@") < 1) throw integrationError_("INVALID_USER_EMAIL", "Email giáo viên không hợp lệ.");
  const normalized = {
    ID: assignment.ID || assignment.id || "",
    UserEmail: email,
    DefaultProfileCode: normalizeCode_(assignment.DefaultProfileCode || assignment.defaultProfileCode),
    WorkerCategory: normalizeCode_(assignment.WorkerCategory || assignment.workerCategory || "PROFESSIONAL_TEACHER"),
    AssistantProfileCode: normalizeCode_(assignment.AssistantProfileCode || assignment.assistantProfileCode),
    EffectiveFrom: toDateCell_(assignment.EffectiveFrom || assignment.effectiveFrom),
    EffectiveTo: toDateCell_(assignment.EffectiveTo || assignment.effectiveTo),
    Status: normalizeStatus_(assignment.Status || assignment.status)
  };
  assertEffectiveDateRange_(normalized.EffectiveFrom, normalized.EffectiveTo);
  return normalized;
}

function normalizeMettasoulActivityPolicy_(policy) {
  policy = policy || {};
  const typeCode = normalizeCode_(policy.ActivityTypeCode || policy.activityTypeCode);
  const unit = normalizeCode_(policy.Unit || policy.unit);
  const code = normalizeCode_(policy.Code || policy.code || typeCode);
  if (!typeCode || !unit || !code) throw integrationError_("ACTIVITY_POLICY_INVALID", "Chính sách hoạt động cần mã, loại hoạt động và đơn vị tính.");
  const normalized = {
    ID: policy.ID || policy.id || "", Code: code,
    Name: String(policy.Name || policy.name || typeCode).trim(), ActivityTypeCode: typeCode,
    RoleCode: normalizeCode_(policy.RoleCode || policy.roleCode || "PARTICIPANT"), Unit: unit,
    CashAmount: toNonNegativeNumber_(policy.CashAmount !== undefined ? policy.CashAmount : policy.cashAmount, "Thù lao công việc"),
    McpPoints: toNonNegativeNumber_(policy.McpPoints !== undefined ? policy.McpPoints : policy.mcpPoints, "Điểm MCP"),
    RequiresEvidence: toBoolean_(policy.RequiresEvidence !== undefined ? policy.RequiresEvidence : policy.requiresEvidence),
    EffectiveFrom: toDateCell_(policy.EffectiveFrom || policy.effectiveFrom), EffectiveTo: toDateCell_(policy.EffectiveTo || policy.effectiveTo),
    Status: normalizeStatus_(policy.Status || policy.status)
  };
  assertEffectiveDateRange_(normalized.EffectiveFrom, normalized.EffectiveTo);
  return normalized;
}

function seedTeachingPayProfiles_(ss, actorEmail) {
  const sheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles);
  const existing = readSheetObjects_(sheet).map(function(row) { return normalizeCode_(row.Code); });
  const seeds = [
    { Code: "TEACHER_A", Name: "Bậc A - Giáo viên chuyên nghiệp", AppliesToRoles: "MAIN_TEACHER,CO_TEACHER", WorkerCategory: "PROFESSIONAL_TEACHER", Unit: "Tiết", BaseRate: 165000, ManagementAllowance: 10000, AllowContextRates: true, ConditionsJson: "{}", Status: "Active" },
    { Code: "TEACHER_B", Name: "Bậc B - Giáo viên đồng hành", AppliesToRoles: "MAIN_TEACHER,CO_TEACHER", WorkerCategory: "PROFESSIONAL_TEACHER", Unit: "Tiết", BaseRate: 155000, ManagementAllowance: 10000, AllowContextRates: true, ConditionsJson: "{}", Status: "Active" },
    { Code: "TEACHER_C", Name: "Bậc C - Giáo viên tiềm năng", AppliesToRoles: "MAIN_TEACHER,CO_TEACHER", WorkerCategory: "PROFESSIONAL_TEACHER", Unit: "Tiết", BaseRate: 145000, ManagementAllowance: 10000, AllowContextRates: true, ConditionsJson: "{}", Status: "Active" },
    { Code: "ASSISTANT_PRO", Name: "Trợ giảng - Giáo viên", AppliesToRoles: "ASSISTANT", WorkerCategory: "PROFESSIONAL_TEACHER", Unit: "Tiết", BaseRate: 80000, ManagementAllowance: 0, AllowContextRates: false, ConditionsJson: "{}", Status: "Active" },
    { Code: "ASSISTANT_STUDENT", Name: "Trợ giảng - Sinh viên", AppliesToRoles: "ASSISTANT", WorkerCategory: "STUDENT_ASSISTANT", Unit: "Tiết", BaseRate: 30000, ManagementAllowance: 0, AllowContextRates: false, ConditionsJson: "{}", Status: "Active" }
  ];
  const missing = seeds.filter(function(seed) { return existing.indexOf(seed.Code) === -1; });
  const now = new Date();
  const records = missing.map(function(seed) {
    return Object.assign({}, normalizeTeachingPayProfile_(seed), {
      ID: "TPR_" + Utilities.getUuid(),
      Version: 1,
      UpdatedAt: now,
      UpdatedBy: actorEmail
    });
  });
  appendObjectRows_(sheet, records);
  records.forEach(function(record) {
    appendPolicyVersion_(ss, "PAY_PROFILE", record.ID, record.Version, record, "CREATE", actorEmail);
  });
  return records.length;
}

/** Activity policy rows are intentionally configured by HRM administrators.
 *  Setup creates the editable policy table but never activates monetary rates. */
function seedMettasoulActivityPolicies_(ss, actorEmail) {
  return 0;
}

function seedTeachingEnvironmentRates_(ss, actorEmail) {
  const sheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.contexts);
  const existing = readSheetObjects_(sheet).filter(function(row) {
    return normalizeCode_(row.ContextType) === "ENVIRONMENT";
  }).map(function(row) { return String(row.ExternalCode || "").toLowerCase(); });
  const seeds = [
    { ContextType: "ENVIRONMENT", ExternalCode: "in_class", Name: "Trong lớp", Amount: 0, Status: "Active" },
    { ContextType: "ENVIRONMENT", ExternalCode: "outdoor", Name: "Ngoài sân", Amount: 20000, Status: "Active" },
    { ContextType: "ENVIRONMENT", ExternalCode: "gym", Name: "Nhà thi đấu", Amount: 20000, Status: "Active" },
    { ContextType: "ENVIRONMENT", ExternalCode: "schoolyard_report", Name: "Báo cáo sân trường", Amount: 20000, Status: "Active" },
    { ContextType: "ENVIRONMENT", ExternalCode: "hall", Name: "Hội trường", Amount: 20000, Status: "Active" }
  ];
  const missing = seeds.filter(function(seed) { return existing.indexOf(seed.ExternalCode) === -1; });
  const now = new Date();
  const records = missing.map(function(seed) {
    return Object.assign({}, normalizeTeachingContextRate_(seed), {
      ID: "TCR_" + Utilities.getUuid(),
      Version: 1,
      UpdatedAt: now,
      UpdatedBy: actorEmail
    });
  });
  appendObjectRows_(sheet, records);
  records.forEach(function(record) {
    appendPolicyVersion_(ss, "CONTEXT_RATE", record.ID, record.Version, record, "CREATE", actorEmail);
  });
  return records.length;
}

function findIntegrationEventByKey_(ss, idempotencyKey) {
  const rows = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.events));
  const matches = rows.filter(function(row) { return String(row.IdempotencyKey || "") === String(idempotencyKey || ""); });
  if (!matches.length) return null;
  for (let i = matches.length - 1; i >= 0; i--) {
    if (normalizeCode_(matches[i].Status) === "CONFIRMED") return matches[i];
  }
  return matches[matches.length - 1];
}

function upsertIntegrationEvent_(ss, event) {
  const sheet = ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.events, INTEGRATION_EVENT_HEADERS_);
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const eventIdIndex = headers.indexOf("EventId");
  let rowIndex = -1;
  let createdAt = new Date();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][eventIdIndex]) === String(event.EventId)) {
      rowIndex = i + 1;
      const createdIndex = headers.indexOf("CreatedAt");
      createdAt = values[i][createdIndex] || createdAt;
      break;
    }
  }
  const output = Object.assign({}, event, { CreatedAt: createdAt, UpdatedAt: new Date() });
  const row = headers.map(function(header) { return Object.prototype.hasOwnProperty.call(output, header) ? output[header] : ""; });
  if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
}

function findWorkLogDate_(ss, workLogId) {
  const rows = readWorkLogObjects_(ss);
  const row = rows.find(function(item) { return String(item.ID || "") === String(workLogId || ""); });
  return row ? String(row.Date || "") : "";
}

function findTeachingWorkLogDate_(ss, originalEvent) {
  const rows = readWorkLogObjects_(ss);
  const row = rows.find(function(item) {
    return teachingWorkLogMatchesEvent_(item, originalEvent);
  });
  return row ? String(row.Date || "") : "";
}

function readWorkLogObjects_(ss) {
  const sheet = ss.getSheetByName("WorkLogs");
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(function(row) {
    return row.some(function(value) { return value !== "" && value !== null; });
  }).map(function(row) {
    return workLogObjectFromValues_(headers, row);
  });
}

function workLogObjectFromValues_(headers, values) {
  const row = {};
  headers.forEach(function(header, index) { row[header] = values[index]; });
  // The original HRM sheet predates the integration and may use localized or
  // blank header labels. Preserve its stable legacy column positions.
  row.ID = row.ID || values[0];
  row.UserEmail = row.UserEmail || values[1];
  row.InputData = row.InputData || row.InputData_JSON || values[4];
  row.Date = row.Date || row.DateLog || values[8];
  row.Status = row.Status || values[9];
  return row;
}

function teachingWorkLogMatchesEvent_(row, originalEvent) {
  const rowId = String(row.ID || "");
  const originalId = String(originalEvent.WorkLogId || "");
  if (rowId && originalId && rowId === originalId) return true;
  if (normalizeCode_(row.Source) !== METTASOUL_INTEGRATION_SCHEMA_.source) return false;

  const integration = safeParseJson_(row.InputData, {}).integration || {};
  const scheduleId = String(row.ScheduleId || integration.scheduleId || "");
  const periodId = String(row.PeriodId || integration.periodId || "");
  const userEmail = String(row.UserEmail || "").trim().toLowerCase();
  return Boolean(scheduleId && periodId) &&
    scheduleId === String(originalEvent.ScheduleId || "") &&
    periodId === String(originalEvent.PeriodId || "") &&
    userEmail === String(originalEvent.UserEmail || "").trim().toLowerCase();
}

function markTeachingWorkLogsDeleted_(ss, originalEvent) {
  const sheet = ss.getSheetByName("WorkLogs");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const statusIndexByName = headers.indexOf("Status");
  const statusIndex = statusIndexByName >= 0 ? statusIndexByName : 9;
  const externalStatusIndex = headers.indexOf("ExternalStatus");
  const updatedAtIndex = headers.indexOf("UpdatedAt");
  const matchedIds = [];
  const changedIds = [];
  for (let i = 1; i < values.length; i++) {
    const row = workLogObjectFromValues_(headers, values[i]);
    if (!teachingWorkLogMatchesEvent_(row, originalEvent)) continue;
    const rowId = String(row.ID || "");
    matchedIds.push(rowId);
    if (normalizeCode_(row.Status) === "DELETED" && normalizeCode_(row.ExternalStatus) === "CANCELLED") continue;
    sheet.getRange(i + 1, statusIndex + 1).setValue("Deleted");
    if (externalStatusIndex >= 0) sheet.getRange(i + 1, externalStatusIndex + 1).setValue("CANCELLED");
    if (updatedAtIndex >= 0) sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date());
    changedIds.push(rowId);
  }
  return { matchedIds: matchedIds, changedIds: changedIds };
}

/**
 * Completes cancellations that HRM already confirmed but whose first request
 * stopped after writing the integration event. This is safe to run repeatedly:
 * WorkLogs use terminal states and MCP reversals are keyed by cancellation EventId.
 */
function reconcileConfirmedMettasoulCancellationsForUser_(ss, userEmail) {
  const email = String(userEmail || "").trim().toLowerCase();
  if (!email) return { checked: 0, cancelledWorkLogs: 0, reversedMcpEntries: 0 };
  const events = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.events));
  const originalsByKey = {};
  events.forEach(function(event) {
    if (normalizeCode_(event.Action) === "SUBMIT_TEACHING_PERIOD") {
      originalsByKey[String(event.IdempotencyKey || "")] = event;
    }
  });
  const result = { checked: 0, cancelledWorkLogs: 0, reversedMcpEntries: 0 };
  events.forEach(function(cancellation) {
    if (normalizeCode_(cancellation.Action) !== "CANCEL_TEACHING_PERIOD" ||
        normalizeCode_(cancellation.Status) !== "CONFIRMED" ||
        String(cancellation.UserEmail || "").trim().toLowerCase() !== email) return;
    const cancellationKey = String(cancellation.IdempotencyKey || "");
    const targetKey = cancellationKey.indexOf("CANCEL:") === 0 ? cancellationKey.slice(7) : "";
    const original = originalsByKey[targetKey];
    if (!original || normalizeCode_(original.Status) !== "CONFIRMED") return;
    result.checked++;
    const workLogResult = markTeachingWorkLogsDeleted_(ss, original);
    result.cancelledWorkLogs += workLogResult.changedIds.length;
    const reversal = reverseTeachingContextMcp_(ss, original, String(cancellation.EventId || ""));
    if (reversal.ledgerId) result.reversedMcpEntries++;
  });
  return result;
}

function markWorkLogDeleted_(ss, workLogId) {
  const sheet = ss.getSheetByName("WorkLogs");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idIndexByName = headers.indexOf("ID");
  const statusIndexByName = headers.indexOf("Status");
  const idIndex = idIndexByName >= 0 ? idIndexByName : 0;
  const statusIndex = statusIndexByName >= 0 ? statusIndexByName : 9;
  const externalStatusIndex = headers.indexOf("ExternalStatus");
  const updatedAtIndex = headers.indexOf("UpdatedAt");
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idIndex]) === String(workLogId)) {
      sheet.getRange(i + 1, statusIndex + 1).setValue("Deleted");
      if (externalStatusIndex >= 0) sheet.getRange(i + 1, externalStatusIndex + 1).setValue("CANCELLED");
      if (updatedAtIndex >= 0) sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date());
      return true;
    }
  }
  // A previous request may have completed the deletion after its HTTP caller
  // timed out. Missing is therefore a successful terminal state for cancel.
  return false;
}

function getSystemConfigValue_(ss, key) {
  const rows = readSheetObjects_(ensureSystemConfigSheet_(ss));
  const found = rows.find(function(row) { return String(row.Key || "") === String(key || ""); });
  return found ? found.Value : "";
}

function getMettasoulIntegrationEnabled_(ss) {
  const stored = String(getSystemConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled) || "").trim();
  const fallback = String(PropertiesService.getScriptProperties().getProperty("METTASOUL_INTEGRATION_ENABLED_BACKUP") || "").trim();
  return String(stored || fallback || "false").toLowerCase() === "true";
}

/**
 * A new or repaired installation starts connected. An explicit admin choice
 * of "false" is preserved as the emergency stop and is never auto-overwritten.
 */
function ensureMettasoulIntegrationDefault_(ss) {
  const stored = String(getSystemConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled) || "").trim();
  const properties = PropertiesService.getScriptProperties();
  const fallback = String(properties.getProperty("METTASOUL_INTEGRATION_ENABLED_BACKUP") || "").trim();
  if (stored || fallback) return;
  setSystemConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled, "true");
  properties.setProperty("METTASOUL_INTEGRATION_ENABLED_BACKUP", "true");
}

function getMettasoulIntegrationTaskId_(ss) {
  const stored = String(getSystemConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.taskId) || "").trim();
  const fallback = String(PropertiesService.getScriptProperties().getProperty("METTASOUL_TEACHING_TASK_ID_BACKUP") || "").trim();
  return stored || fallback;
}

function setSystemConfigValue_(ss, key, value) {
  const sheet = ensureSystemConfigSheet_(ss);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function isEffectiveRow_(row, workDate) {
  if (normalizeCode_(row.Status) !== "ACTIVE") return false;
  const date = String(workDate || "");
  const from = toYmd_(row.EffectiveFrom);
  const to = toYmd_(row.EffectiveTo);
  return (!from || date >= from) && (!to || date <= to);
}

function toYmd_(value) {
  if (!value) return "";
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const text = String(value).trim();
  const match = text.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function toDateCell_(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw integrationError_("INVALID_EFFECTIVE_DATE", "Ngày hiệu lực phải có định dạng yyyy-MM-dd.");
  return text;
}

function assertEffectiveDateRange_(from, to) {
  if (from && to && String(from) > String(to)) {
    throw integrationError_("INVALID_EFFECTIVE_RANGE", "Ngày hết hiệu lực phải bằng hoặc sau ngày bắt đầu.");
  }
}

function normalizeStatus_(value) {
  return normalizeCode_(value || "ACTIVE") === "INACTIVE" ? "Inactive" : "Active";
}

function normalizeCode_(value) {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function normalizeJsonText_(value) {
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  const text = String(value || "{}").trim() || "{}";
  try { JSON.parse(text); } catch (error) { throw integrationError_("INVALID_RULE_JSON", "Điều kiện JSON không hợp lệ."); }
  return text;
}

function safeParseJson_(value, fallback) {
  try { return value ? JSON.parse(String(value)) : fallback; } catch (error) { return fallback; }
}

function toNonNegativeNumber_(value, label) {
  const number = Number(value || 0);
  if (!isFinite(number) || number < 0) throw integrationError_("INVALID_AMOUNT", label + " không hợp lệ.");
  return Math.round(number);
}

function toBoolean_(value) {
  return value === true || String(value).toLowerCase() === "true" || Number(value) === 1;
}

function bytesToHex_(bytes) {
  return bytes.map(function(value) {
    const normalized = value < 0 ? value + 256 : value;
    return ("0" + normalized.toString(16)).slice(-2);
  }).join("");
}

function constantTimeEquals_(left, right) {
  left = String(left || "");
  right = String(right || "");
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

function integrationError_(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
