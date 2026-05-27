const WEBHOOK_SECRET = "ls_gas_8409e821_f67f_40f0_8a3b_64dbcc1eb42b";
const LESSON_PLAN_FOLDER_ID = "1Tn0cqAsXjbrLlV8G2MTewMd8TL6P44tD";
const SPREADSHEET_ID = "1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0";

const APP_NAME = "HỌC VIỆN METTASOUL";
const GAS_WEBHOOK_VERSION = "mettasoul-gas-2026-05-27";
const SCHEDULE_EMAIL_SYSTEM_TITLE = "HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ NĂNG SỐNG | HỌC VIỆN METTASOUL";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function doPost(e) {
  var startedAt = new Date();
  var payload = null;
  var requestId = "n/a";

  try {
    payload = parsePayload(e);
    requestId = asText(payload.requestId) || createRequestId();

    if (payload.secret !== WEBHOOK_SECRET) {
      throw appError("UNAUTHORIZED", "Invalid webhook secret.");
    }

    if (payload.action === "uploadLessonPlan") {
      var uploadResult = uploadLessonPlan(payload, requestId);
      logInfo("uploadLessonPlan.success", requestId, {
        scheduleId: uploadResult.lessonPlan.scheduleId,
        teacherId: uploadResult.lessonPlan.teacherId,
        driveFileId: uploadResult.lessonPlan.driveFileId,
        latencyMs: new Date().getTime() - startedAt.getTime(),
      });
      return json({
        ok: true,
        requestId: requestId,
        version: GAS_WEBHOOK_VERSION,
        message: "Lesson plan uploaded successfully.",
        lessonPlan: uploadResult.lessonPlan,
      });
    }

    if (payload.action === "deleteLessonPlan") {
      var deleteResult = deleteLessonPlan(payload, requestId);
      logInfo("deleteLessonPlan.success", requestId, {
        lessonPlanId: deleteResult.lessonPlanId,
        driveFileId: deleteResult.driveFileId,
      });
      return json({
        ok: true,
        requestId: requestId,
        version: GAS_WEBHOOK_VERSION,
        message: "Lesson plan deleted successfully.",
        lessonPlanId: deleteResult.lessonPlanId,
      });
    }

    if (payload.action === "sendScheduleEmail" || (payload.to && payload.subject && payload.html)) {
      sendScheduleEmail(payload, requestId);
      return json({
        ok: true,
        requestId: requestId,
        version: GAS_WEBHOOK_VERSION,
        message: "Email sent.",
      });
    }

    if (payload.action === "ping") {
      return json({
        ok: true,
        requestId: requestId,
        version: GAS_WEBHOOK_VERSION,
        message: APP_NAME + " GAS webhook is ready.",
      });
    }

    throw appError("UNKNOWN_ACTION", "Unknown action: " + payload.action);
  } catch (error) {
    var normalized = normalizeError(error, requestId);
    logError("webhook.error", requestId, {
      code: normalized.errorCode,
      message: normalized.message,
      stack: normalized.stack,
      action: payload ? payload.action : "unknown",
    });
    return json({
      ok: false,
      requestId: requestId,
      version: GAS_WEBHOOK_VERSION,
      errorCode: normalized.errorCode,
      error: normalized.message,
    });
  }
}

function parsePayload(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw appError("PAYLOAD_MISSING", "Request payload is missing.");
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw appError("PAYLOAD_INVALID_JSON", "Request payload must be valid JSON.", error);
  }
}

function sendScheduleEmail(payload, requestId) {
  var html = normalizeScheduleEmailHtml(asText(payload.html));
  var subject = normalizeScheduleEmailSubject(asText(payload.subject));

  if (!asText(payload.to) || !subject || !html) {
    throw appError("EMAIL_FIELDS_MISSING", "Missing required email fields.");
  }

  MailApp.sendEmail({
    to: asText(payload.to),
    subject: subject,
    htmlBody: html,
    name: APP_NAME,
  });

  logInfo("sendScheduleEmail.success", requestId, {
    to: asText(payload.to),
    subject: subject,
    templateVersion: asText(payload.templateVersion),
  });
}

function normalizeScheduleEmailSubject(subject) {
  return subject
    .replace(/Life Skill/gi, APP_NAME)
    .replace(/Mettasoul/gi, "METTASOUL")
    .toUpperCase();
}

function normalizeScheduleEmailHtml(html) {
  var normalized = html
    .replace(/HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ TRỐNG\s*\|\s*HỌC VIỆN METTASOUL/gi, "HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ NĂNG SỐNG | HỌC VIỆN METTASOUL")
    .replace(/HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ TRỐNG\s*\|\s*METTASOUL/gi, "HỆ THỐNG THÔNG BÁO LỊCH DẠY KỸ NĂNG SỐNG | HỌC VIỆN METTASOUL")
    .replace(/KỸ TRỐNG/gi, "KỸ NĂNG SỐNG")
    .replace(/Life Skill/gi, APP_NAME)
    .replace(/Th phân cảm và trắc ẩn/gi, "Thấu cảm và trắc ẩn")
    .replace(/giáo vụ vừa lịch giảng dạy/gi, "giáo vụ vừa giao lịch dạy")
    .replace(/mở webapp/gi, "mở ứng dụng web")
    .replace(/>Trường</g, ">TRƯỜNG<")
    .replace(/>học</g, ">LỚP<")
    .replace(/>tiêu đề</gi, ">MỤC TIÊU<")
    .replace(/>Xác định</g, ">XÁC NHẬN<")
    .replace(/Xác định không thể/gi, "XÁC NHẬN TẤT CẢ (TẤT CẢ LỊCH ĐƯỢC XÁC NHẬN)");

  normalized = forceScheduleSystemTitle(normalized);
  normalized = forceScheduleGreeting(normalized);
  normalized = forceKnownLessonTitles(normalized);

  return normalized;
}

function forceScheduleSystemTitle(html) {
  return html.replace(
    /(<p\b[^>]*text-align\s*:\s*center[^>]*>)[\s\S]*?(<\/p>\s*<h1\b)/i,
    "$1" + SCHEDULE_EMAIL_SYSTEM_TITLE + "$2"
  );
}

function forceScheduleGreeting(html) {
  return html
    .replace(/giáo vụ vừa\s+lịch giảng dạy\s+vào\s+tuần/gi, "giáo vụ vừa giao lịch dạy cho tuần")
    .replace(/giáo vụ vừa\s+lịch giảng dạy\s+cho\s+tuần/gi, "giáo vụ vừa giao lịch dạy cho tuần")
    .replace(/giáo vụ vừa\s+giao lịch dạy\s+vào\s+tuần/gi, "giáo vụ vừa giao lịch dạy cho tuần");
}

function forceKnownLessonTitles(html) {
  return html
    .replace(/Th[^<]{0,24}trắc ẩn/gi, "Thấu cảm và trắc ẩn")
    .replace(/Th[^<]{0,24}tr&#7855;c &#7849;n/gi, "Thấu cảm và trắc ẩn");
}

function uploadLessonPlan(payload, requestId) {
  validateUploadPayload(payload);

  var bytes = Utilities.base64Decode(payload.fileData);
  var blob = Utilities.newBlob(
    bytes,
    asText(payload.mimeType) || "application/octet-stream",
    asText(payload.fileName)
  );

  var file;
  try {
    file = DriveApp.getFolderById(LESSON_PLAN_FOLDER_ID).createFile(blob);
  } catch (error) {
    var message = String(error && error.message ? error.message : error);
    if (message.indexOf("permission") !== -1 || message.indexOf("Permission") !== -1) {
      throw appError(
        "DRIVE_PERMISSION_DENIED",
        "Apps Script deployment does not have Drive permission. Re-authorize and deploy new version.",
        error
      );
    }
    if (message.indexOf("Folder") !== -1 || message.indexOf("folder") !== -1) {
      throw appError("DRIVE_FOLDER_NOT_FOUND", "Cannot access Drive folder with configured ID.", error);
    }
    throw appError("DRIVE_UPLOAD_FAILED", "Cannot create file in Google Drive.", error);
  }

  var now = new Date().toISOString();
  var lessonPlan = {
    id: createId("lp"),
    scheduleId: asText(payload.scheduleId),
    teacherId: asText(payload.teacherId),
    fileName: asText(payload.fileName),
    driveFileId: file.getId(),
    driveUrl: file.getUrl(),
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
    requestId: requestId,
  };

  try {
    appendRecord("LessonPlans", lessonPlan);
  } catch (error) {
    throw appError("SHEET_APPEND_FAILED", "Cannot append lesson plan to Google Sheets.", error);
  }

  try {
    updateScheduleStatus(asText(payload.scheduleId), now);
  } catch (error) {
    var statusMessage = String(error && error.message ? error.message : error);
    if (statusMessage.indexOf("Cannot find schedule") !== -1) {
      throw appError("SCHEDULE_NOT_FOUND", statusMessage, error);
    }
    throw appError("SHEET_UPDATE_FAILED", "Cannot update schedule status in Google Sheets.", error);
  }

  return { lessonPlan: lessonPlan };
}

function validateUploadPayload(payload) {
  var scheduleId = asText(payload.scheduleId);
  var teacherId = asText(payload.teacherId);
  var fileName = asText(payload.fileName);
  var fileData = asText(payload.fileData);
  var fileSize = Number(payload.fileSize || 0);

  if (!scheduleId || !teacherId || !fileName || !fileData) {
    throw appError("UPLOAD_FIELDS_MISSING", "Missing required upload fields.");
  }

  if (!isFinite(fileSize) || fileSize <= 0) {
    throw appError("UPLOAD_FILE_SIZE_INVALID", "Invalid file size.");
  }

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw appError("PAYLOAD_TOO_LARGE", "Lesson plan file exceeds 10 MB limit.");
  }
}

function appendRecord(sheetName, record) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName);
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i += 1) {
    var header = asText(headers[i]);
    row.push(Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "");
  }
  sheet.appendRow(row);
}

function updateScheduleStatus(scheduleId, now) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Schedules");
  if (!sheet) {
    throw new Error("Missing sheet: Schedules");
  }

  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idIndex = headers.indexOf("id");
  var statusIndex = headers.indexOf("status");
  var updatedAtIndex = headers.indexOf("updatedAt");

  if (idIndex === -1 || statusIndex === -1) {
    throw appError("SHEET_HEADER_MISSING", "Schedules sheet must contain 'id' and 'status' columns.");
  }

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][idIndex] || "") === scheduleId) {
      sheet.getRange(rowIndex + 1, statusIndex + 1).setValue("lesson_plan_uploaded");
      if (updatedAtIndex !== -1) {
        sheet.getRange(rowIndex + 1, updatedAtIndex + 1).setValue(now);
      }
      return;
    }
  }

  throw new Error("Cannot find schedule: " + scheduleId);
}

function deleteLessonPlan(payload, requestId) {
  var lessonPlanId = asText(payload.lessonPlanId);
  if (!lessonPlanId) {
    throw appError("DELETE_FIELDS_MISSING", "Missing lessonPlanId.");
  }

  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("LessonPlans");
  if (!sheet) {
    throw appError("SHEET_NOT_FOUND", "Missing sheet: LessonPlans");
  }

  var values = sheet.getDataRange().getValues();
  var headers = values[0] || [];
  var idIndex = headers.indexOf("id");
  var driveFileIdIndex = headers.indexOf("driveFileId");

  if (idIndex === -1) {
    throw appError("SHEET_HEADER_MISSING", "LessonPlans sheet must contain 'id' column.");
  }

  var rowToDelete = -1;
  var driveFileId = "";

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][idIndex] || "") === lessonPlanId) {
      rowToDelete = rowIndex + 1;
      if (driveFileIdIndex !== -1) {
        driveFileId = String(values[rowIndex][driveFileIdIndex] || "").trim();
      }
      break;
    }
  }

  if (rowToDelete === -1) {
    throw appError("LESSON_PLAN_NOT_FOUND", "Cannot find lesson plan: " + lessonPlanId);
  }

  if (driveFileId) {
    try {
      DriveApp.getFileById(driveFileId).setTrashed(true);
    } catch (error) {
      throw appError("DRIVE_DELETE_FAILED", "Cannot delete lesson plan file from Google Drive.", error);
    }
  }

  try {
    sheet.deleteRow(rowToDelete);
  } catch (error) {
    throw appError("SHEET_DELETE_FAILED", "Cannot delete lesson plan from Google Sheets.", error);
  }

  return {
    lessonPlanId: lessonPlanId,
    driveFileId: driveFileId,
    requestId: requestId,
  };
}

function authorizeDriveAndSheets() {
  DriveApp.getFolderById(LESSON_PLAN_FOLDER_ID).getName();
  SpreadsheetApp.openById(SPREADSHEET_ID).getName();
  MailApp.getRemainingDailyQuota();
  return "Authorized Drive, Sheets and Mail scopes.";
}

function createId(prefix) {
  return prefix + "-" + Utilities.getUuid().slice(0, 8);
}

function createRequestId() {
  return "gas-" + Utilities.getUuid().slice(0, 12);
}

function asText(value) {
  return String(value || "").trim();
}

function appError(code, message, cause) {
  var err = new Error(message);
  err.code = code;
  if (cause) {
    err.cause = cause;
  }
  return err;
}

function normalizeError(error, requestId) {
  if (error && error.code && error.message) {
    return {
      requestId: requestId,
      errorCode: String(error.code),
      message: String(error.message),
      stack: error.stack ? String(error.stack) : "",
    };
  }

  if (error instanceof Error) {
    return {
      requestId: requestId,
      errorCode: "UNEXPECTED_ERROR",
      message: error.message || "Unexpected Apps Script error.",
      stack: error.stack ? String(error.stack) : "",
    };
  }

  return {
    requestId: requestId,
    errorCode: "UNEXPECTED_ERROR",
    message: String(error || "Unexpected Apps Script error."),
    stack: "",
  };
}

function logInfo(eventName, requestId, context) {
  console.info(JSON.stringify({ level: "INFO", event: eventName, requestId: requestId, context: context }));
}

function logError(eventName, requestId, context) {
  console.error(JSON.stringify({ level: "ERROR", event: eventName, requestId: requestId, context: context }));
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
