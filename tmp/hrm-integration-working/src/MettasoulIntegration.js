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

// HRM installations created before the current schema use Vietnamese/legacy
// header names in WorkLogs.  The payroll screens still read these columns by
// position, so an integration row must write to the existing header rather
// than silently creating an empty parallel field.
const WORKLOG_HEADER_ALIASES_ = Object.freeze({
  ID: ["ID", "LogID"],
  UserEmail: ["UserEmail"],
  TaskId: ["TaskId", "TaskID"],
  TaskName: ["TaskName"],
  InputData: ["InputData", "InputData_JSON"],
  Quantity: ["Quantity", "CalculatedValue"],
  Money: ["Money", "TotalMoney"],
  Timestamp: ["Timestamp"],
  Date: ["Date", "DateLog"],
  Status: ["Status"]
});

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

function setupMettasoulIntegration(actorEmail) {
  if (actorEmail) assertHrmAdmin_(actorEmail);
  const ss = getDatabase();
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles, TEACHING_PAY_PROFILE_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.contexts, TEACHING_CONTEXT_RATE_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.assignments, PAY_PROFILE_ASSIGNMENT_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies, ACTIVITY_POLICY_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger, MCP_LEDGER_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.versions, TASK_POLICY_VERSION_HEADERS_);
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.events, INTEGRATION_EVENT_HEADERS_);
  ensureSystemConfigSheet_(ss);
  ensureWorkLogIntegrationColumns_(ss);
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

function getTeachingPayAdminData(actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase();
  setupMettasoulIntegration(actorEmail);
  const secretConfigured = Boolean(
    PropertiesService.getScriptProperties().getProperty(METTASOUL_INTEGRATION_SCHEMA_.secretProperty)
  );
  return {
    profiles: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles)).map(serializeSheetObject_),
    contexts: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.contexts)).map(serializeSheetObject_),
    assignments: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.assignments)).map(serializeSheetObject_),
    activityPolicies: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies)).map(serializeSheetObject_),
    mcpLedger: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger)).map(serializeSheetObject_),
    tasks: getAllTasks(),
    integration: {
      enabled: String(getMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled) || "false").toLowerCase() === "true",
      taskId: String(getMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.taskId) || ""),
      secretConfigured: secretConfigured,
      schemaVersion: METTASOUL_INTEGRATION_SCHEMA_.version
    }
  };
}

function saveTeachingPayProfile(profile, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase();
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

function saveTeachingContextRate(contextRate, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase();
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

function savePayProfileAssignment(assignment, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase();
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

function saveMettasoulActivityPolicy(policy, actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase();
  ensureIntegrationSheet_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies, ACTIVITY_POLICY_HEADERS_);
  const normalized = normalizeMettasoulActivityPolicy_(policy);
  const result = versionedUpsert_(ss, METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies, ACTIVITY_POLICY_HEADERS_, normalized, "Code", "ACTIVITY_POLICY", actorEmail, "MAP_");
  return { success: true, activityPolicy: result };
}

/**
 * Configures the approved 2026-2027 MELIS session rates. HRM stays the
 * authority: METTASOUL submits only the completed activity type and does not
 * send an amount or any MCP value.
 */
function applyMettasoulMelisActivityPolicies(actorEmail) {
  assertHrmAdmin_(actorEmail);
  const policies = [
    {
      Code: "MELIS_SESSION_1_STUDENT", Name: "Giáo viên MELIS (1 học viên)",
      ActivityTypeCode: "MELIS_SESSION_1_STUDENT", RoleCode: "PARTICIPANT", Unit: "SESSION",
      CashAmount: 270000, McpPoints: 0, RequiresEvidence: false, Status: "Active"
    },
    {
      Code: "MELIS_SESSION_2_STUDENTS", Name: "Giáo viên MELIS (2 học viên)",
      ActivityTypeCode: "MELIS_SESSION_2_STUDENTS", RoleCode: "PARTICIPANT", Unit: "SESSION",
      CashAmount: 400000, McpPoints: 0, RequiresEvidence: false, Status: "Active"
    }
  ];
  const saved = policies.map(function(policy) {
    return saveMettasoulActivityPolicy(policy, actorEmail).activityPolicy;
  });
  return { success: true, activityPolicies: saved };
}

/**
 * Applies a visible pilot policy without changing webhook state. Only HRM
 * workers provisioned from METTASOUL are included, plus the student assistant
 * explicitly identified by the administrator. Legacy HRM accounts stay intact.
 */
function applyMettasoulPilotPayPolicy(actorEmail) {
  assertHrmAdmin_(actorEmail);
  const ss = getDatabase();
  setupMettasoulIntegration(actorEmail);
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

  assignments.forEach(function(assignment) { savePayProfileAssignment(assignment, actorEmail); });
  saveTeachingContextRate({ ContextType: "SCHOOL", ExternalCode: "s-8ce3530f", Name: "TRƯỜNG THPT TÂN TÚC — BÌNH CHÁNH", Amount: 15000, McpPoints: 5, Status: "Active" }, actorEmail);
  saveTeachingContextRate({ ContextType: "SCHOOL", ExternalCode: "s-b55e24a3", Name: "TRƯỜNG PT NK TDTT BÌNH CHÁNH — BÌNH CHÁNH", Amount: 15000, McpPoints: 5, Status: "Active" }, actorEmail);
  return { success: true, assignedTeachers: teachers.length, assignedProfessionalAssistants: teachers.length, assignedStudentAssistants: 1, farSchoolContexts: 2, integrationEnabled: String(getMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled) || "false").toLowerCase() === "true" };
}

/**
 * Creates HRM worker records from the METTASOUL identity directory without
 * creating a second, usable HRM password.  Pay-profile assignment remains a
 * separate explicit admin action.
 */
function provisionMettasoulWorkersFromJson(jsonText, actorEmail) {
  assertHrmAdmin_(actorEmail);
  let identities;
  try {
    identities = JSON.parse(String(jsonText || "[]"));
  } catch (error) {
    throw integrationError_("IDENTITY_JSON_INVALID", "Danh sách định danh METTASOUL phải là JSON hợp lệ.");
  }
  return provisionMettasoulWorkers_(identities, actorEmail);
}

/**
 * Aligns only the HRM display name with the authoritative METTASOUL identity
 * directory. Email, role, payroll configuration, work logs and all other HRM
 * columns are deliberately left untouched.
 */
function syncMettasoulWorkerNamesFromJson(jsonText, actorEmail) {
  assertHrmAdmin_(actorEmail);
  let identities;
  try {
    identities = JSON.parse(String(jsonText || "[]"));
  } catch (error) {
    throw integrationError_("IDENTITY_JSON_INVALID", "Danh sách định danh METTASOUL phải là JSON hợp lệ.");
  }
  if (!Array.isArray(identities) || identities.length === 0) {
    throw integrationError_("IDENTITY_LIST_REQUIRED", "Cần ít nhất một định danh METTASOUL để đồng bộ tên.");
  }

  const authoritativeNames = new Map();
  identities.forEach(function(identity) {
    const email = String(identity && identity.email || "").trim().toLowerCase();
    const name = String(identity && identity.name || "").trim();
    if (email && name) authoritativeNames.set(email, name);
  });
  if (authoritativeNames.size === 0) {
    throw integrationError_("IDENTITY_LIST_REQUIRED", "Danh sách METTASOUL không có email và tên hợp lệ để đồng bộ.");
  }

  const ss = getDatabase();
  const sheet = ss.getSheetByName("Users");
  if (!sheet) throw integrationError_("USERS_SHEET_MISSING", "HRM chưa có bảng Users.");
  const values = sheet.getDataRange().getValues();
  if (values.length === 0) throw integrationError_("USERS_SHEET_MISSING", "Bảng Users của HRM chưa có tiêu đề.");
  const headers = values[0].map(String);
  const emailColumn = headers.indexOf("Email") >= 0 ? headers.indexOf("Email") : 0;
  const nameColumn = headers.indexOf("Name") >= 0 ? headers.indexOf("Name") : 3;
  const matched = new Set();
  const updated = [];
  let unchanged = 0;

  values.slice(1).forEach(function(row, index) {
    const email = String(row[emailColumn] || "").trim().toLowerCase();
    const authoritativeName = authoritativeNames.get(email);
    if (!authoritativeName) return;
    matched.add(email);
    const currentName = String(row[nameColumn] || "").trim();
    if (currentName === authoritativeName) {
      unchanged += 1;
      return;
    }
    sheet.getRange(index + 2, nameColumn + 1).setValue(authoritativeName);
    updated.push({ email: email, from: currentName, to: authoritativeName });
  });

  const notFound = Array.from(authoritativeNames.keys()).filter(function(email) { return !matched.has(email); });
  appendPolicyVersion_(ss, "IDENTITY_NAME_SYNC", "METTASOUL", 1, {
    requested: authoritativeNames.size,
    updated: updated.length,
    unchanged: unchanged,
    notFound: notFound.length
  }, "UPDATE", actorEmail);
  return {
    success: true,
    updated: updated.length,
    unchanged: unchanged,
    notFound: notFound.length,
    changes: updated,
    message: "Đã đồng bộ " + updated.length + " tên từ METTASOUL; " + unchanged + " tên đã đúng."
  };
}

/** Fetches the public METTASOUL identity directory server-to-server, so an
 * HRM administrator does not need to copy personal data through a browser
 * form before aligning display names. */
function syncMettasoulWorkerNamesFromDirectory(actorEmail) {
  assertHrmAdmin_(actorEmail);
  const response = UrlFetchApp.fetch("https://giaovukns.mettasoul.vn/api/users", { muteHttpExceptions: true });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw integrationError_("METTASOUL_DIRECTORY_UNAVAILABLE", "Không đọc được danh sách định danh từ METTASOUL (HTTP " + status + ").");
  }
  return syncMettasoulWorkerNamesFromJson(response.getContentText(), actorEmail);
}

function provisionMettasoulWorkers_(identities, actorEmail) {
  if (!Array.isArray(identities) || identities.length === 0) {
    throw integrationError_("IDENTITY_LIST_REQUIRED", "Cần ít nhất một định danh METTASOUL để tạo hồ sơ nhân sự.");
  }
  const ss = getDatabase();
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

function buildMettasoulWorkerRow_(headers, identity, now) {
  const teacherId = String(identity.teacherId || "").trim();
  const settings = {
    identityProvider: "METTASOUL",
    managedBy: "METTASOUL",
    mettasoulUserId: String(identity.userId || "").trim(),
    mettasoulTeacherId: teacherId,
    mettasoulRole: String(identity.role || "").trim(),
    provisionedAt: now.toISOString()
  };
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

function saveMettasoulIntegrationSettings(settings, actorEmail) {
  assertHrmAdmin_(actorEmail);
  settings = settings || {};
  const ss = getDatabase();
  setupMettasoulIntegration(actorEmail);
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

  setMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.taskId, taskId);
  setMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled, enabled ? "true" : "false");
  const persistedEnabled = String(getMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled) || "false").toLowerCase() === "true";
  const persistedTaskId = String(getMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.taskId) || "");
  if (persistedEnabled !== enabled || persistedTaskId !== taskId) {
    throw integrationError_("CONFIG_PERSIST_FAILED", "HRM không thể lưu ổn định cấu hình METTASOUL.");
  }
  appendPolicyVersion_(ss, "INTEGRATION_SETTINGS", "METTASOUL", 1, {
    enabled: persistedEnabled,
    taskId: persistedTaskId,
    secretChanged: Boolean(newSecret)
  }, "UPDATE", actorEmail);
  return {
    success: true,
    enabled: enabled,
    taskId: taskId,
    secretConfigured: Boolean(PropertiesService.getScriptProperties().getProperty(METTASOUL_INTEGRATION_SCHEMA_.secretProperty))
  };
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
    return { ok: true, code: "READY", schemaVersion: METTASOUL_INTEGRATION_SCHEMA_.version };
  }
  if (action === "GET_MCP_LEDGER") return getMettasoulMcpLedger_(payload);
  if (action === "SUBMIT_TEACHING_PERIOD") return submitTeachingPeriod_(payload, verified.payloadHash);
  if (action === "SUBMIT_ACTIVITY_COMPLETION") return submitActivityCompletion_(payload, verified.payloadHash);
  if (action === "CANCEL_TEACHING_PERIOD") return cancelTeachingPeriod_(payload, verified.payloadHash);
  throw integrationError_("UNSUPPORTED_ACTION", "Nghiệp vụ webhook chưa được hỗ trợ.");
}

/** Read-only, signed projection for the currently authenticated METTASOUL user.
 *  The browser never chooses an email: METTASOUL's server supplies it after
 *  validating its own session. Payroll policy and source rows remain in HRM. */
function getMettasoulMcpLedger_(payload) {
  const userEmail = String((payload || {}).userEmail || "").trim().toLowerCase();
  if (!userEmail) throw integrationError_("MISSING_FIELD", "Thiếu email người dùng để đọc sổ MCP.");
  const ss = getDatabase();
  const sheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger);
  if (!sheet || sheet.getLastRow() < 2) {
    return { ok: true, code: "MCP_LEDGER", schemaVersion: METTASOUL_INTEGRATION_SCHEMA_.version, entries: [] };
  }
  const allEntries = readSheetObjects_(sheet)
    .filter(function(row) { return String(row.UserEmail || "").trim().toLowerCase() === userEmail; });
  // A deleted schedule is represented by a compensating ledger row in HRM.
  // Keep that audit pair in HRM but hide both rows from the operational view.
  const reversedScheduleIds = {};
  allEntries.forEach(function(row) {
    if (normalizeCode_(row.ReasonCode) === "TEACHING_FAR_SCHOOL_REVERSAL") {
      reversedScheduleIds[String(row.ActivityId || "")] = true;
    }
  });
  const entries = allEntries
    .filter(function(row) {
      return !reversedScheduleIds[String(row.ActivityId || "")];
    })
    .sort(function(left, right) {
      return String(right.CreatedAt || "").localeCompare(String(left.CreatedAt || ""));
    })
    .slice(0, 100)
    .map(function(row) {
      return {
        id: String(row.ID || ""),
        points: Number(row.Points || 0),
        entryType: normalizeCode_(row.EntryType) === "REVERSAL" ? "REVERSAL" : "CREDIT",
        reasonCode: String(row.ReasonCode || ""),
        reasonName: String(row.ReasonName || ""),
        schoolName: findMettasoulLedgerSchoolName_(ss, row),
        workDate: formatMettasoulLedgerDate_(row.WorkDate),
        status: String(row.Status || ""),
        createdAt: formatMettasoulLedgerDate_(row.CreatedAt)
      };
    });
  return { ok: true, code: "MCP_LEDGER", schemaVersion: METTASOUL_INTEGRATION_SCHEMA_.version, entries: entries };
}

function findMettasoulLedgerSchoolName_(ss, ledgerRow) {
  const scheduleId = String((ledgerRow || {}).ActivityId || "").trim();
  if (!scheduleId) return "";
  const event = readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.events)).find(function(item) {
    return String(item.ScheduleId || "") === scheduleId && normalizeCode_(item.Action) === "SUBMIT_TEACHING_PERIOD";
  });
  if (!event || !event.WorkLogId) return "";
  const workLog = readSheetObjects_(ss.getSheetByName("WorkLogs")).find(function(item) {
    return String(readWorkLogField_(item, "ID") || "") === String(event.WorkLogId);
  });
  const input = safeParseJson_(workLog ? readWorkLogField_(workLog, "InputData") : "", {});
  return String(input && input.school && input.school.name || "").trim();
}

function formatMettasoulLedgerDate_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");
  }
  return String(value || "");
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

function submitTeachingPeriod_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (error) {
    throw integrationError_("SYSTEM_BUSY", "HRM đang xử lý yêu cầu khác, vui lòng thử lại.");
  }

  try {
    const ss = getDatabase();
    assertIntegrationReady_(ss);
    ensureWorkLogIntegrationColumns_(ss);
    const input = normalizeTeachingPeriodPayload_(payload);
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
      if (checkIsLocked(month)) throw integrationError_("PAYROLL_LOCKED", "Tháng " + month + " đã khóa sổ.");
      assertHrmUserExists_(ss, input.userEmail);
      const assignment = resolvePayAssignment_(ss, input.userEmail, input.workDate);
      const profile = resolveTeachingPayProfile_(ss, assignment, input.roleCode, input.workDate);
      const taskId = String(getMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.taskId) || "");
      const task = getAuthoritativeTaskById_(ss, taskId);
      const calculation = calculateTeachingPeriodPay_(ss, input, profile);
      const workLogId = "LOG_MTS_" + Utilities.getUuid();
      appendIntegratedWorkLog_(ss, workLogId, task, input, profile, calculation);
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
    const ss = getDatabase();
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
      if (checkIsLocked(input.workDate.slice(0, 7))) throw integrationError_("PAYROLL_LOCKED", "Tháng " + input.workDate.slice(0, 7) + " đã khóa sổ.");
      assertHrmUserExists_(ss, input.userEmail);
      const policy = resolveActivityPolicy_(ss, input);
      if (toBoolean_(policy.RequiresEvidence) && !input.evidenceUrl) throw integrationError_("EVIDENCE_REQUIRED", "Hoạt động này cần minh chứng trước khi duyệt.");
      const cashAmount = toNonNegativeNumber_(policy.CashAmount, "Thù lao công việc");
      const mcpPoints = toNonNegativeNumber_(policy.McpPoints, "Điểm MCP");
      let workLogId = "";
      if (cashAmount > 0) {
        const taskId = String(getMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.taskId) || "");
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
  appendWorkLogObject_(ss.getSheetByName("WorkLogs"), {
    ID: workLogId, UserEmail: input.userEmail, TaskId: task.id, TaskName: task.name,
    InputData: JSON.stringify({ integration: { source: METTASOUL_INTEGRATION_SCHEMA_.source, eventId: input.eventId, idempotencyKey: input.idempotencyKey, activityId: input.activityId, assignmentId: input.assignmentId }, activity: { typeCode: input.activityTypeCode, title: input.activityTitle, roleCode: input.roleCode, unit: input.unit, evidenceUrl: input.evidenceUrl }, calculation: { money: money, policyCode: policy.Code } }),
    Quantity: 1, Money: money, Timestamp: new Date(), Date: input.workDate, Status: "Active", Source: METTASOUL_INTEGRATION_SCHEMA_.source,
    ExternalEventId: input.eventId, ScheduleId: input.activityId, PeriodId: input.assignmentId, RoleCode: input.roleCode,
    PolicyVersion: "ACTIVITY_POLICY:" + String(policy.Version || 1), RateProfileId: policy.ID, CalculationJson: JSON.stringify({ money: money, policyCode: policy.Code }), ExternalStatus: "CONFIRMED", UpdatedAt: new Date()
  });
}

function cancelTeachingPeriod_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (error) {
    throw integrationError_("SYSTEM_BUSY", "HRM đang xử lý yêu cầu khác, vui lòng thử lại.");
  }
  try {
    const ss = getDatabase();
    assertIntegrationReady_(ss);
    const targetKey = String(payload.targetIdempotencyKey || "").trim();
    const eventId = String(payload.eventId || "").trim();
    if (!targetKey || !eventId) throw integrationError_("INVALID_CANCEL_REQUEST", "Thiếu khóa dòng công cần hủy.");
    const existingCancellation = findIntegrationEventByKey_(ss, "CANCEL:" + targetKey);
    if (existingCancellation && normalizeCode_(existingCancellation.Status) === "CONFIRMED") {
      const previous = safeParseJson_(existingCancellation.ResponseJson, {});
      previous.idempotent = true;
      return previous;
    }
    const original = findIntegrationEventByKey_(ss, targetKey);
    if (!original || normalizeCode_(original.Status) !== "CONFIRMED") {
      throw integrationError_("WORKLOG_NOT_FOUND", "Không tìm thấy dòng công đang hiệu lực.");
    }
    const workDate = findWorkLogDate_(ss, original.WorkLogId);
    if (workDate && checkIsLocked(workDate.slice(0, 7))) {
      throw integrationError_("PAYROLL_LOCKED", "Tháng chứa dòng công đã khóa sổ.");
    }
    markWorkLogDeleted_(ss, original.WorkLogId);
    const mcpReversal = reverseTeachingContextMcp_(ss, original, eventId);
    const response = {
      ok: true,
      code: "WORKLOG_CANCELLED",
      eventId: eventId,
      targetIdempotencyKey: targetKey,
      workLogId: original.WorkLogId,
      mcpReversalPoints: mcpReversal.points,
      mcpReversalLedgerId: mcpReversal.ledgerId
    };
    upsertIntegrationEvent_(ss, {
      EventId: eventId,
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
    periodEndAt: String(payload.periodEndAt || "").trim()
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
  const baseRate = toNonNegativeNumber_(profile.BaseRate, "Đơn giá cơ bản");
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

  const total = Math.round(baseRate + schoolAllowance + environmentAllowance + managementAllowance);
  return {
    quantity: 1,
    unit: String(profile.Unit || "Tiết"),
    baseRate: baseRate,
    schoolAllowance: schoolAllowance,
    environmentAllowance: environmentAllowance,
    managementAllowance: managementAllowance,
    mcpPoints: toNonNegativeNumber_(schoolContext.McpPoints, "Điểm MCP trường"),
    total: total,
    profileCode: String(profile.Code || ""),
    profileId: String(profile.ID || ""),
    policyVersion: "PROFILE:" + String(profile.Version || 1) + ";SCHEMA:" + METTASOUL_INTEGRATION_SCHEMA_.version
  };
}

/** MCP for teaching is only granted from the authoritative HRM school context.
 *  The context controls both effective dates and whether the point value is zero. */
function awardTeachingContextMcp_(ss, input, calculation) {
  const points = toNonNegativeNumber_(calculation.mcpPoints, "Điểm MCP trường");
  if (!points) return "";
  const ledgerId = "MCP_MTS_" + Utilities.getUuid();
  appendObjectRow_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger), {
    ID: ledgerId, UserEmail: input.userEmail, Points: points, EntryType: "CREDIT",
    ReasonCode: "TEACHING_FAR_SCHOOL", ReasonName: "Dạy hoặc trợ giảng tại trường xa",
    Source: METTASOUL_INTEGRATION_SCHEMA_.source, ExternalEventId: input.eventId,
    ActivityId: input.scheduleId, AssignmentId: input.periodId, WorkDate: input.workDate,
    EvidenceUrl: "", Status: "Active", CreatedAt: new Date(), UpdatedAt: new Date()
  });
  return ledgerId;
}

/** Preserve an auditable append-only ledger: cancellation offsets the credit. */
function reverseTeachingContextMcp_(ss, originalEvent, cancellationEventId) {
  const sheet = ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.mcpLedger);
  const originalEventId = String(originalEvent.EventId || "");
  const credit = readSheetObjects_(sheet).find(function(row) {
    return String(row.ExternalEventId || "") === originalEventId &&
      normalizeCode_(row.ReasonCode) === "TEACHING_FAR_SCHOOL" &&
      normalizeCode_(row.EntryType) === "CREDIT";
  });
  if (!credit) return { ledgerId: "", points: 0 };
  const points = toNonNegativeNumber_(credit.Points, "Điểm MCP cần đảo");
  if (!points) return { ledgerId: "", points: 0 };
  const ledgerId = "MCP_MTS_REV_" + Utilities.getUuid();
  appendObjectRow_(sheet, {
    ID: ledgerId, UserEmail: originalEvent.UserEmail, Points: -points, EntryType: "REVERSAL",
    ReasonCode: "TEACHING_FAR_SCHOOL_REVERSAL", ReasonName: "Đảo điểm do hủy tiết dạy/trợ giảng",
    Source: METTASOUL_INTEGRATION_SCHEMA_.source, ExternalEventId: cancellationEventId,
    ActivityId: originalEvent.ScheduleId, AssignmentId: originalEvent.PeriodId,
    WorkDate: findWorkLogDate_(ss, originalEvent.WorkLogId), EvidenceUrl: "", Status: "Active",
    CreatedAt: new Date(), UpdatedAt: new Date()
  });
  return { ledgerId: ledgerId, points: -points };
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
    calculation: calculation
  };
  appendWorkLogObject_(sheet, {
    ID: workLogId,
    UserEmail: input.userEmail,
    TaskId: task.id,
    TaskName: task.name,
    InputData: JSON.stringify(inputData),
    Quantity: 1,
    Money: calculation.total,
    Timestamp: new Date(),
    Date: input.workDate,
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

function assertIntegrationReady_(ss) {
  const enabled = String(getMettasoulRuntimeConfigValue_(ss, METTASOUL_INTEGRATION_SCHEMA_.config.enabled) || "false").toLowerCase() === "true";
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
  const rows = readSheetObjects_(getDatabase().getSheetByName("Users"));
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
  const user = rows.find(function(row) { return String(row.Email || "").trim().toLowerCase() === email; });
  const tags = user ? String(user.Tags || "").toUpperCase() : "";
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

/**
 * Write the canonical integration object into either the current WorkLogs
 * schema or the legacy spreadsheet schema used by existing payroll reports.
 * This prevents a successful webhook response from leaving TotalMoney blank.
 */
function appendWorkLogObject_(sheet, object) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const required = ["ID", "UserEmail", "TaskId", "TaskName", "Quantity", "Money", "Timestamp", "Date", "Status"];
  required.forEach(function(field) {
    if (workLogHeaderIndex_(headers, field) < 0) {
      throw integrationError_("WORKLOG_SCHEMA_UNSUPPORTED", "WorkLogs thiếu cột bắt buộc cho " + field + ".");
    }
  });
  sheet.appendRow(headers.map(function(header, index) {
    const canonical = canonicalWorkLogField_(header, index, headers);
    return canonical && Object.prototype.hasOwnProperty.call(object, canonical)
      ? object[canonical]
      : (Object.prototype.hasOwnProperty.call(object, header) ? object[header] : "");
  }));
}

function canonicalWorkLogField_(header, index, headers) {
  const normalized = String(header || "").trim().toLowerCase();
  // Older HRM spreadsheets store Status in column J but leave its header
  // empty. Keep that positional contract so existing dashboard/payroll code
  // continues to see Active/Deleted at index 9.
  if (!normalized && index === 9 && workLogHeaderIndex_(headers, "Status") === 9) return "Status";
  return Object.keys(WORKLOG_HEADER_ALIASES_).find(function(field) {
    return WORKLOG_HEADER_ALIASES_[field].some(function(alias) {
      return String(alias).toLowerCase() === normalized;
    });
  }) || "";
}

function workLogHeaderIndex_(headers, canonicalField) {
  const aliases = WORKLOG_HEADER_ALIASES_[canonicalField] || [canonicalField];
  const explicitIndex = headers.findIndex(function(header) {
    return aliases.some(function(alias) {
      return String(alias).toLowerCase() === String(header).trim().toLowerCase();
    });
  });
  if (explicitIndex >= 0) return explicitIndex;
  return canonicalField === "Status" && headers.length > 9 && !String(headers[9] || "").trim() ? 9 : -1;
}

function readWorkLogField_(row, canonicalField) {
  const aliases = WORKLOG_HEADER_ALIASES_[canonicalField] || [canonicalField];
  for (let i = 0; i < aliases.length; i++) {
    if (Object.prototype.hasOwnProperty.call(row, aliases[i])) return row[aliases[i]];
  }
  if (canonicalField === "Status" && Object.prototype.hasOwnProperty.call(row, "")) return row[""];
  return "";
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
  return rows.find(function(row) { return String(row.IdempotencyKey || "") === String(idempotencyKey || ""); }) || null;
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
  const rows = readSheetObjects_(ss.getSheetByName("WorkLogs"));
  const row = rows.find(function(item) {
    return String(readWorkLogField_(item, "ID") || "") === String(workLogId || "");
  });
  return row ? String(readWorkLogField_(row, "Date") || "") : "";
}

function markWorkLogDeleted_(ss, workLogId) {
  const sheet = ss.getSheetByName("WorkLogs");
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const idIndex = workLogHeaderIndex_(headers, "ID");
  const statusIndex = workLogHeaderIndex_(headers, "Status");
  const externalStatusIndex = headers.indexOf("ExternalStatus");
  const updatedAtIndex = headers.indexOf("UpdatedAt");
  for (let i = 1; i < values.length; i++) {
    if (idIndex >= 0 && String(values[i][idIndex]) === String(workLogId)) {
      if (statusIndex >= 0) sheet.getRange(i + 1, statusIndex + 1).setValue("Deleted");
      if (externalStatusIndex >= 0) sheet.getRange(i + 1, externalStatusIndex + 1).setValue("CANCELLED");
      if (updatedAtIndex >= 0) sheet.getRange(i + 1, updatedAtIndex + 1).setValue(new Date());
      return;
    }
  }
  throw integrationError_("WORKLOG_NOT_FOUND", "Không tìm thấy dòng công cần hủy.");
}

function getSystemConfigValue_(ss, key) {
  const rows = readSheetObjects_(ensureSystemConfigSheet_(ss));
  const found = rows.find(function(row) { return String(row.Key || "") === String(key || ""); });
  return found ? found.Value : "";
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

/**
 * Web-app requests do not always have an active spreadsheet. Keep the small
 * runtime switch and task mapping in project-wide Script Properties so the
 * admin UI, anonymous webhook and background executions share one value.
 * SystemConfig remains a visible mirror and migration source for old installs.
 */
function getMettasoulRuntimeConfigValue_(ss, key) {
  const properties = PropertiesService.getScriptProperties();
  const stored = properties.getProperty(key);
  if (stored !== null) return stored;
  const legacyValue = getSystemConfigValue_(ss, key);
  if (legacyValue !== "" && legacyValue !== null && legacyValue !== undefined) {
    properties.setProperty(key, String(legacyValue));
  }
  return legacyValue;
}

function setMettasoulRuntimeConfigValue_(ss, key, value) {
  const normalized = String(value === null || value === undefined ? "" : value);
  PropertiesService.getScriptProperties().setProperty(key, normalized);
  setSystemConfigValue_(ss, key, normalized);
  return normalized;
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
