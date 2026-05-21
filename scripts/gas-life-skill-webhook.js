const WEBHOOK_SECRET = "ls_gas_8409e821_f67f_40f0_8a3b_64dbcc1eb42b";
const LESSON_PLAN_FOLDER_ID = "1Tn0cqAsXjbrLlV8G2MTewMd8TL6P44tD";
const SPREADSHEET_ID = "1wTbm61GHwmvza94UmNeptTAmhSlLEPHQaoCLC7uMni0";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (payload.secret !== WEBHOOK_SECRET) {
      return json({ ok: false, error: "Unauthorized" });
    }

    if (payload.action === "uploadLessonPlan") {
      return json(uploadLessonPlan(payload));
    }

    return json(sendScheduleEmail(payload));
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

function sendScheduleEmail(payload) {
  MailApp.sendEmail({
    to: payload.to,
    subject: payload.subject,
    htmlBody: payload.html,
    name: "Life Skill",
  });

  return { ok: true };
}

function uploadLessonPlan(payload) {
  if (!payload.scheduleId || !payload.teacherId || !payload.fileName || !payload.fileData) {
    throw new Error("Missing lesson plan upload fields.");
  }

  const bytes = Utilities.base64Decode(payload.fileData);
  const blob = Utilities.newBlob(bytes, payload.mimeType || "application/octet-stream", payload.fileName);
  const file = DriveApp.getFolderById(LESSON_PLAN_FOLDER_ID).createFile(blob);
  const now = new Date().toISOString();
  const lessonPlan = {
    id: createId("lp"),
    scheduleId: payload.scheduleId,
    teacherId: payload.teacherId,
    fileName: payload.fileName,
    driveFileId: file.getId(),
    driveUrl: file.getUrl(),
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  appendRecord("LessonPlans", lessonPlan);
  updateScheduleStatus(payload.scheduleId, now);

  return { ok: true, lessonPlan };
}

function appendRecord(sheetName, record) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
  if (!sheet) {
    throw new Error("Missing sheet: " + sheetName);
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map((header) => record[header] || ""));
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

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
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

function createId(prefix) {
  return prefix + "-" + Utilities.getUuid().slice(0, 8);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
