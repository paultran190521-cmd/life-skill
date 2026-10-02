function applyCancelSupportCalculation_(calculation, input) {
  const percent = Number(input.supportPercent);
  const fullTotal = Number(calculation.total);
  if ([0, 50, 100].indexOf(percent) < 0 || !isFinite(fullTotal) || fullTotal < 0 || !input.adminReason || !input.approvedBy) {
    throw integrationError_("INVALID_SUPPORT_REVIEW", "Mức hỗ trợ hoặc tiền công gốc không hợp lệ.");
  }
  return Object.assign({}, calculation, {
    fullTeachingAmount: fullTotal,
    total: Math.round(fullTotal * percent / 100),
    supportPercent: percent,
    supportReason: input.adminReason,
    supportApprovedBy: input.approvedBy,
    policyVersion: String(calculation.policyVersion || "") + ";CANCEL_SUPPORT:" + percent
  });
}
/** Adjust an already confirmed teaching period in place after admin cancellation review. */
function adjustCancelledTeachingPeriod_(payload, payloadHash) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(500)) throw integrationError_("SYSTEM_BUSY", "HRM đang xử lý một yêu cầu khác.");
  try {
    const ss = getDatabase_();
    assertIntegrationReady_(ss);
    const key = String(payload.targetIdempotencyKey || "").trim();
    const percent = Number(payload.supportPercent);
    const reason = String(payload.adminReason || "").trim();
    const adminEmail = String(payload.adminEmail || "").trim().toLowerCase();
    if (!key || [0, 50, 100].indexOf(percent) < 0 || !reason || reason.length > 2000 || !adminEmail || !payload.eventId) {
      throw integrationError_("INVALID_SUPPORT_REVIEW", "Thiếu mức hỗ trợ, lý do hoặc người duyệt.");
    }
    const adjustmentKey = "ADJUST:" + key;
    const prior = findIntegrationEventByKey_(ss, adjustmentKey);
    if (prior && normalizeCode_(prior.Status) === "CONFIRMED") {
      if (String(prior.PayloadHash || "") !== String(payloadHash || "")) throw integrationError_("ADJUSTMENT_ALREADY_REVIEWED", "Mức hỗ trợ đã được duyệt với nội dung khác.");
      return safeParseJson_(prior.ResponseJson, {});
    }
    const original = findIntegrationEventByKey_(ss, key);
    if (!original || normalizeCode_(original.Status) !== "CONFIRMED") throw integrationError_("WORKLOG_NOT_CONFIRMED", "Chưa có dòng công HRM được xác nhận để điều chỉnh.");
    const workLog = findDurableTeachingWorkLog_(ss, original.EventId);
    if (!workLog || normalizeCode_(workLog.Status) !== "ACTIVE") throw integrationError_("WORKLOG_NOT_ACTIVE", "Dòng công HRM không còn hiệu lực.");
    const stored = safeParseJson_(workLog.InputData || workLog.InputData_JSON, {});
    const previous = stored.calculation || {};
    const originalTotal = Number(previous.fullTeachingAmount !== undefined ? previous.fullTeachingAmount : previous.total);
    if (!isFinite(originalTotal) || originalTotal < 0) throw integrationError_("INVALID_ORIGINAL_PAY", "Không tìm thấy tiền công gốc.");
    const calculation = Object.assign({}, previous, {
      fullTeachingAmount: originalTotal,
      total: Math.round(originalTotal * percent / 100),
      supportPercent: percent,
      supportReason: reason,
      supportApprovedBy: adminEmail,
      policyVersion: String(previous.policyVersion || "") + ";CANCEL_SUPPORT:" + percent
    });
    if (!updateTeachingWorkLogPolicySnapshot_(ss, workLog, calculation)) throw integrationError_("WORKLOG_UPDATE_FAILED", "Không cập nhật được dòng công HRM.");
    updateTeachingIntegrationEventResponse_(ss, original, calculation);
    const response = { ok: true, code: "CANCEL_SUPPORT_ADJUSTED", eventId: String(payload.eventId), workLogId: String(workLog.ID), money: calculation.total, mcpPoints: calculation.mcpPoints, supportPercent: percent, policyVersion: calculation.policyVersion };
    upsertIntegrationEvent_(ss, { EventId: String(payload.eventId), IdempotencyKey: adjustmentKey, Action: "ADJUST_CANCELLED_PERIOD", Source: "METTASOUL", PayloadHash: payloadHash, Status: "CONFIRMED", WorkLogId: String(workLog.ID), UserEmail: adminEmail, ScheduleId: String(original.ScheduleId || ""), PeriodId: String(original.PeriodId || ""), ResponseJson: JSON.stringify(response), ErrorMessage: "" });
    return response;
  } finally { lock.releaseLock(); }
}