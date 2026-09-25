/** Scheduled activity rules. HRM owns amounts, worker category and MCP. */
function calculateScheduledTopicPay_(ss, input, profile) {
  const codes = ["STUDENT_TOPIC_REPORT_SUPPORT", "STUDENT_TOPIC_REPORT_LEAD", "PARTNER_FREE_TOPIC", "DEMO_SESSION"];
  if (input.policyContract !== "TOPIC_REPORT_V1" || input.environmentCode !== "schoolyard_report" || codes.indexOf(input.activityTypeCode) < 0) throw integrationError_("INVALID_TOPIC_REPORT", "Loại hoạt động hoặc môi trường không hợp lệ.");
  if (!input.approvedBy) throw integrationError_("ACTIVITY_APPROVAL_REQUIRED", "Chuyên đề chưa được admin duyệt.");
  if (!Number.isInteger(input.principalCount) || input.principalCount < 1 || (["STUDENT_TOPIC_REPORT_LEAD", "PARTNER_FREE_TOPIC"].indexOf(input.activityTypeCode) >= 0 && input.principalCount !== 1)) throw integrationError_("INVALID_PRINCIPAL_COUNT", "Số giáo viên chính không đúng chính sách hoạt động.");
  const assistant = input.roleCode === "ASSISTANT";
  const policy = resolveActivityPolicy_(ss, { activityTypeCode: input.activityTypeCode, roleCode: "PARTICIPANT", unit: input.activityTypeCode === "DEMO_SESSION" ? "SESSION" : "TOPIC", workDate: input.workDate });
  if (toBoolean_(policy.RequiresEvidence) && !/^https:\/\//i.test(input.evidenceUrl)) throw integrationError_("EVIDENCE_REQUIRED", "Chuyên đề cần minh chứng.");
  const durationMinutes = getTeachingPeriodDurationMinutes_(input.periodStartAt, input.periodEndAt);
  if (durationMinutes <= 0) throw integrationError_("INVALID_DURATION", "Thời lượng không hợp lệ.");
  const units = DOUBLE_PAY_DURATION_MINUTES_.indexOf(durationMinutes) >= 0 ? 2 : 1;
  const school = findTeachingContextRate_(ss, "SCHOOL", input.schoolId, input.workDate) || {};
  const schoolMcp = isFarSchoolMcpContext_(school) ? TEACHING_MCP_PER_PERIOD_ * units : 0;
  const activityMcp = assistant ? 0 : toNonNegativeNumber_(policy.McpPoints, "MCP hoạt động");
  const money = assistant ? toNonNegativeNumber_(profile.BaseRate, "Thù lao trợ giảng") : toNonNegativeNumber_(policy.CashAmount, "Thù lao chuyên đề");
  return { quantity: 1, unit: policy.Unit, total: money, baseRate: money, schoolAllowance: 0, environmentAllowance: 0, managementAllowance: 0,
    durationMinutes: durationMinutes, payMultiplier: 1, schoolPeriodUnits: units, activityMcp: activityMcp, schoolContextMcp: schoolMcp, mcpPoints: activityMcp + schoolMcp,
    activityTypeCode: input.activityTypeCode, activityName: input.activityTypeCode === "PARTNER_FREE_TOPIC" ? "Chuyên đề phụ huynh/giáo viên" : String(policy.Name),
    profileId: profile.ID, profileCode: profile.Code, policyVersion: "TOPIC_REPORT_V1;ACTIVITY:" + String(policy.Version || 1) + ";PROFILE:" + String(profile.Version || 1) };
}

function assertPeriodNotReportedCancelled_(ss, key) {
  const report = findIntegrationEventByKey_(ss, "REPORT:" + key);
  const cancellation = findIntegrationEventByKey_(ss, "CANCEL:" + key);
  if ((report && normalizeCode_(report.Status) === "CONFIRMED") || (cancellation && normalizeCode_(cancellation.Status) === "CONFIRMED")) throw integrationError_("PERIOD_CANCELLED", "Tiết này đã bị hủy.");
}

/** A durable tombstone under the payroll lock closes the completion/cancellation race. */
function reportCancelledPeriod_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(500)) throw integrationError_("SYSTEM_BUSY", "HRM đang đối chiếu, yêu cầu hủy sẽ được gửi lại.");
  try {
    const ss = getDatabase_();
    assertIntegrationReady_(ss);
    const key = String(payload.targetIdempotencyKey || "").trim();
    const reason = String(payload.reason || "").trim();
    if (!key || !reason || reason.length > 2000 || !payload.eventId || !payload.userEmail || !payload.scheduleId) throw integrationError_("INVALID_CANCEL_REQUEST", "Thiếu thông tin báo hủy.");
    const prior = findIntegrationEventByKey_(ss, "REPORT:" + key);
    if (prior && normalizeCode_(prior.Status) === "CONFIRMED") return safeParseJson_(prior.ResponseJson, {});
    const original = findIntegrationEventByKey_(ss, key);
    if (original && normalizeCode_(original.Status) === "CONFIRMED") throw integrationError_("WORKLOG_ALREADY_CONFIRMED", "HRM đã ghi nhận công. Admin cần xử lý hủy.");
    // A partially completed payroll write must be reconciled, never treated as unpaid.
    if (original && findDurableTeachingWorkLog_(ss, original.EventId)) throw integrationError_("WORKLOG_ALREADY_CONFIRMED", "Dòng công đang đối chiếu. Admin cần xử lý.");
    const response = { ok: true, code: "PERIOD_REPORTED_CANCELLED", eventId: payload.eventId };
    upsertIntegrationEvent_(ss, { EventId: payload.eventId, IdempotencyKey: "REPORT:" + key, Action: "REPORT_CANCELLED_PERIOD", Source: "METTASOUL", PayloadHash: payloadHash, Status: "CONFIRMED", WorkLogId: "", UserEmail: payload.userEmail, ScheduleId: payload.scheduleId, PeriodId: payload.scheduleId, ResponseJson: JSON.stringify(response), ErrorMessage: reason });
    return response;
  } finally { lock.releaseLock(); }
}

function findDurableTeachingWorkLog_(ss, eventId) {
  const values = ss.getSheetByName("WorkLogs").getDataRange().getValues();
  const headers = values[0].map(String);
  for (let i = 1; i < values.length; i++) {
    const row = workLogObjectFromValues_(headers, values[i]);
    const input = safeParseJson_(row.InputData, {});
    if (String(row.ID) === "LOG_MTS_" + eventId || String(row.ExternalEventId || (input.integration || {}).eventId || "") === String(eventId)) return row;
  }
  return null;
}

/** Signed, read-only release check. Never seeds or changes financial policies. */
function getTopicReportPolicies_() {
  const ss = getDatabase_();
  const codes = ["STUDENT_TOPIC_REPORT_SUPPORT", "STUDENT_TOPIC_REPORT_LEAD", "PARTNER_FREE_TOPIC", "DEMO_SESSION"];
  return { ok: true, code: "TOPIC_REPORT_POLICIES", policyContract: "TOPIC_REPORT_V1",
    policies: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.activityPolicies)).filter(function(row) { return codes.indexOf(row.ActivityTypeCode) >= 0; }).map(serializeSheetObject_),
    assistants: readSheetObjects_(ss.getSheetByName(METTASOUL_INTEGRATION_SCHEMA_.sheets.profiles)).filter(function(row) { return ["ASSISTANT_PRO", "ASSISTANT_STUDENT"].indexOf(row.Code) >= 0; }).map(serializeSheetObject_) };
}
