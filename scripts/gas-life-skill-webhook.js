const WEBHOOK_SECRET = "ls_gas_8409e821_f67f_40f0_8a3b_64dbcc1eb42b";
const LESSON_PLAN_FOLDER_ID = "1Tn0cqAsXjbrLlV8G2MTewMd8TL6P44tD";
const SPREADSHEET_ID = "1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function doPost(e) {
  const startedAt = new Date();
  let payload;
  let requestId = "n/a";
  try {
    payload = parsePayload(e);
    requestId = asText(payload.requestId) || createRequestId();

    if (payload.secret !== WEBHOOK_SECRET) {
      throw appError("UNAUTHORIZED", "Invalid webhook secret.");
    }

    if (payload.action === "uploadLessonPlan") {
      const result = uploadLessonPlan(payload, requestId);
      logInfo("uploadLessonPlan.success", requestId, {
        scheduleId: result.lessonPlan.scheduleId,
        teacherId: result.lessonPlan.teacherId,
        driveFileId: result.lessonPlan.driveFileId,
        latencyMs: new Date().getTime() - startedAt.getTime(),
      });
      return json({
        ok: true,
        requestId,
        message: "Lesson plan uploaded successfully.",
        lessonPlan: result.lessonPlan,
      });
    }

    if (payload.action === "deleteLessonPlan") {
      const result = deleteLessonPlan(payload, requestId);
      logInfo("deleteLessonPlan.success", requestId, {
        lessonPlanId: result.lessonPlanId,
        driveFileId: result.driveFileId,
      });
      return json({
        ok: true,
        requestId,
        message: "Lesson plan deleted successfully.",
        lessonPlanId: result.lessonPlanId,
      });
    }

    if (payload.action === "ping") {
      return json({ ok: true, requestId, message: "HỌC VIỆN METTASOUL GAS webhook is ready." });
    }

    if (payload.to && payload.subject && payload.html) {
      sendScheduleEmail(payload);
      return json({ ok: true, requestId, message: "Email sent." });
    }

    throw appError("UNKNOWN_ACTION", "Unknown action: " + payload.action);
  } catch (error) {
    const normalized = normalizeError(error, requestId);
    logError("webhook.error", requestId, {
      code: normalized.errorCode,
      message: normalized.message,
      stack: normalized.stack,
      action: payload ? payload.action : "unknown",
    });
    return json({
      ok: false,
      requestId,
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

function sendScheduleEmail(payload) {
  MailApp.sendEmail({
    to: payload.to,
    subject: payload.subject,
    htmlBody: payload.html,
    name: "HỌC VIỆN METTASOUL",
  });
}

function uploadLessonPlan(payload, requestId) {
  validateUploadPayload(payload);

  const bytes = Utilities.base64Decode(payload.fileData);
  const blob = Utilities.newBlob(
    bytes,
    asText(payload.mimeType) || "application/octet-stream",
    asText(payload.fileName),
  );

  let file;
  try {
    file = DriveApp.getFolderById(LESSON_PLAN_FOLDER_ID).createFile(blob);
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (message.indexOf("permission") !== -1 || message.indexOf("Permission") !== -1) {
      throw appError(
        "DRIVE_PERMISSION_DENIED",
        "Apps Script deployment does not have Drive permission. Re-authorize and deploy new version.",
        error,
      );
    }
    if (message.indexOf("Folder") !== -1 || message.indexOf("folder") !== -1) {
      throw appError("DRIVE_FOLDER_NOT_FOUND", "Cannot access Drive folder with configured ID.", error);
    }
    throw appError("DRIVE_UPLOAD_FAILED", "Cannot create file in Google Drive.", error);
  }

  const now = new Date().toISOString();
  const lessonPlan = {
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
    const message = String(error && error.message ? error.message : error);
    if (message.indexOf("Cannot find schedule") !== -1) {
      throw appError("SCHEDULE_NOT_FOUND", message, error);
    }
    throw appError("SHEET_UPDATE_FAILED", "Cannot update schedule status in Google Sheets.", error);
  }

  return { lessonPlan: lessonPlan };
}

function validateUploadPayload(payload) {
  const scheduleId = asText(payload.scheduleId);
  const teacherId = asText(payload.teacherId);
  const fileName = asText(payload.fileName);
  const fileData = asText(payload.fileData);
  const fileSize = Number(payload.fileSize || 0);

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
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(
    headers.map(function (header) {
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : "";
    }),
  );
}

function updateScheduleStatus(scheduleId, now) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Schedules");
  if (!sheet) {
    throw new Error("Missing sheet: Schedules");
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf("id");
  const statusIndex = headers.indexOf("status");
  const updatedAtIndex = headers.indexOf("updatedAt");

  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][idIndex]) === scheduleId) {
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
  const lessonPlanId = asText(payload.lessonPlanId);
  if (!lessonPlanId) {
    throw appError("DELETE_FIELDS_MISSING", "Missing lessonPlanId.");
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("LessonPlans");
  if (!sheet) {
    throw appError("SHEET_NOT_FOUND", "Missing sheet: LessonPlans");
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const idIndex = headers.indexOf("id");
  const driveFileIdIndex = headers.indexOf("driveFileId");

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
  const err = new Error(message);
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
