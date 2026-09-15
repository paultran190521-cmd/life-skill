// Only managed chat images expire. Messages, documents and pasted links remain.
function chatImageExpiryMs_(value) {
  var date = new Date(value);
  if (!value || !isFinite(date.getTime())) return null;
  var day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 5);
  var lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

function cleanupExpiredChatImages(options) {
  var dryRun = !options || options.dryRun !== false;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { busy: true, dryRun: dryRun };
  try {
    var started = Date.now();
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("LessonPlanAttachments");
    if (!sheet || sheet.getLastRow() < 2) return { dryRun: dryRun, eligible: 0, trashed: 0 };
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(String);
    ["id", "kind", "createdAt", "driveFileId", "lessonPlanId"].forEach(function(name) {
      if (headers.indexOf(name) < 0) throw new Error("Missing retention column: " + name);
    });
    var rows = values.slice(1).map(function(values) {
      var row = {}; headers.forEach(function(key, index) { row[key] = values[index]; }); return row;
    });
    var protectedFiles = {};
    rows.forEach(function(other) {
      var expiry = chatImageExpiryMs_(other.createdAt);
      if (other.driveFileId && (other.kind !== "image" || expiry === null || expiry > started)) protectedFiles[String(other.driveFileId)] = true;
    });
    var plansSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("LessonPlans");
    if (!plansSheet) throw new Error("Cannot verify lesson-plan files before retention cleanup.");
    var plans = plansSheet.getDataRange().getValues();
    var planFileColumn = plans[0].map(String).indexOf("driveFileId");
    if (planFileColumn < 0) throw new Error("Missing lesson-plan driveFileId column.");
    plans.slice(1).forEach(function(plan) { if (plan[planFileColumn]) protectedFiles[String(plan[planFileColumn])] = true; });
    var stats = { dryRun: dryRun, eligible: 0, trashed: 0, skipped: 0, failed: 0 };
    var expiredColumn = headers.indexOf("expiredAt") + 1;
    if (!dryRun && !expiredColumn) {
      expiredColumn = headers.length + 1;
      sheet.getRange(1, expiredColumn).setValue("expiredAt");
    }
    for (var index = 0; index < rows.length; index++) {
      var row = rows[index];
      var expiry = chatImageExpiryMs_(row.createdAt);
      if (row.kind !== "image" || row.expiredAt || !row.driveFileId || expiry === null || expiry > started) continue;
      stats.eligible++;
      if (dryRun) continue;
      if (stats.trashed + stats.failed >= 100 || Date.now() - started > 240000) break;
      // A file reused by a non-expired attachment must not be removed.
      var shared = protectedFiles[String(row.driveFileId)];
      if (shared) { stats.skipped++; continue; }
      try {
        var file = DriveApp.getFileById(String(row.driveFileId));
        if (file.getMimeType().indexOf("image/") !== 0) { stats.skipped++; continue; }
        // Verify the exact lesson-plan folder AND its configured chat root.
        var parents = file.getParents(); var managed = false;
        while (parents.hasNext()) {
          var parent = parents.next();
          if (parent.getName() !== "lesson-plan-" + row.lessonPlanId) continue;
          var roots = parent.getParents();
          while (roots.hasNext()) if (roots.next().getId() === LESSON_PLAN_CHAT_FOLDER_ID) managed = true;
        }
        if (!managed) { stats.skipped++; continue; }
        if (String(sheet.getRange(index + 2, headers.indexOf("id") + 1).getValue()) !== String(row.id)) { stats.skipped++; continue; }
        if (!file.isTrashed()) file.setTrashed(true);
        sheet.getRange(index + 2, expiredColumn).setValue(new Date().toISOString());
        stats.trashed++;
      } catch (error) { stats.failed++; console.error("Chat retention failed for attachment " + row.id + ": " + error.message); }
    }
    if (!dryRun) PropertiesService.getScriptProperties().setProperty("CHAT_RETENTION_LAST_RUN", JSON.stringify({ at: new Date().toISOString(), stats: stats }));
    return stats;
  } finally { lock.releaseLock(); }
}

function runChatImageRetentionDaily() { return cleanupExpiredChatImages({ dryRun: false }); }

function previewChatImageRetention() {
  var result = cleanupExpiredChatImages({ dryRun: true });
  console.log(JSON.stringify(result));
  return result;
}

function installChatImageRetention() {
  var existing = ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === "runChatImageRetentionDaily"; });
  if (!existing.length) ScriptApp.newTrigger("runChatImageRetentionDaily").timeBased().everyDays(1).atHour(3).inTimezone("Asia/Ho_Chi_Minh").create();
  return chatImageRetentionStatus();
}

function chatImageRetentionStatus() {
  return { months: 5, triggers: ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === "runChatImageRetentionDaily"; }).length,
    lastRun: PropertiesService.getScriptProperties().getProperty("CHAT_RETENTION_LAST_RUN") };
}
