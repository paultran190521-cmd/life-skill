const INTAKE_INPUT = 'Nhập lịch';
const INTAKE_CATALOG = 'Danh mục';
const INTAKE_BATCHES = 'Đợt duyệt';
const INTAKE_SUBMITTER = 'mynhung.ipale@gmail.com';
const INTAKE_REVIEWER = 'nguyenphuong.ipale@gmail.com';
const INTAKE_DIRECTOR = 'dangphuongvietnam@gmail.com';
const INTAKE_API_BASE = 'https://giaovukns.mettasoul.vn';

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Xác nhận lịch')
    .addItem('Mở màn hình xác nhận', 'openIntakeSidebar')
    .addItem('Cập nhật trường, lớp và tiết từ app', 'refreshIntakeCatalog')
    .addToUi();
}

function openIntakeSidebar() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Approval').setTitle('Xác nhận lịch trường'));
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Approval').setTitle('METTASOUL · Xác nhận lịch');
}

function intakeApi_(method, data) {
  const options = {
    method: method.toLowerCase(),
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
    followRedirects: false,
  };
  if (method === 'POST') options.payload = JSON.stringify(data);
  const response = UrlFetchApp.fetch(INTAKE_API_BASE + '/api/school-intake', options);
  let body;
  try { body = JSON.parse(response.getContentText()); } catch (_) { body = {}; }
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    const details = Array.isArray(body.errors) ? body.errors.map(x => 'Dòng ' + x.index + ': ' + x.message).join('\n') : '';
    throw new Error([body.error || body.message || 'App từ chối thao tác.', details].filter(Boolean).join('\n'));
  }
  return body;
}

function intakeContext() {
  const email = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  if (![INTAKE_SUBMITTER, INTAKE_REVIEWER].includes(email)) throw new Error('Tài khoản Google này không được phép xác nhận lịch.');
  const workbook = SpreadsheetApp.getActive();
  const catalog = workbook.getSheetByName(INTAKE_CATALOG);
  const schools = catalog.getLastRow() > 1 ? catalog.getRange(2, 1, catalog.getLastRow() - 1, 1).getDisplayValues().map(row => row[0]).filter(Boolean) : [];
  const batches = workbook.getSheetByName(INTAKE_BATCHES);
  const all = batches.getLastRow() > 1 ? batches.getRange(2, 1, batches.getLastRow() - 1, 18).getDisplayValues() : [];
  const pending = all.filter(row => row[4] === 'WAITING_REVIEW').map(row => ({ id: row[0], school: row[1], weekStart: row[2], count: row[5] }));
  const unnotified = all.filter(row => row[4] === 'SYNCED' && !row[16]).map(row => ({ id: row[0], school: row[1], weekStart: row[2], count: row[5] }));
  return { email, role: email === INTAKE_SUBMITTER ? 'submitter' : 'reviewer', schools, pending, unnotified };
}

function intakeAction(input) {
  const mode = String(input.mode || '');
  if (mode === 'preview') return intakeActionUnlocked_(input);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Một thao tác xác nhận khác đang chạy. Vui lòng thử lại sau.');
  try { return intakeActionUnlocked_(input); } finally { lock.releaseLock(); }
}

function intakeActionUnlocked_(input) {
  const context = intakeContext();
  const mode = String(input.mode || '');
  if (mode === 'submit' && context.role !== 'submitter') throw new Error('Chỉ Mỹ Nhung được gửi lịch vòng 1.');
  if (['apply', 'reject', 'notify'].includes(mode) && context.role !== 'reviewer') throw new Error('Chỉ Nguyễn Phương được xác nhận vòng 2.');
  if (mode === 'notify') return notifyDirector_(String(input.batchId || ''));
  const result = intakeApi_('POST', { mode, school: input.school || '', weekStart: input.weekStart || '', batchId: input.batchId || '', note: input.note || '' });
  result.mail = { sent: false, reason: '' };
  try {
    const sheetUrl = SpreadsheetApp.getActive().getUrl();
    if (mode === 'submit' && result.batchId) {
      MailApp.sendEmail({ to: INTAKE_REVIEWER, subject: 'METTASOUL · Lịch trường chờ Nguyễn Phương xác nhận',
        body: 'Mỹ Nhung đã gửi lịch ' + input.school + ' tuần ' + input.weekStart + '.\nMã đợt: ' + result.batchId + '\nMới: ' + result.summary.newCount + ', sửa: ' + result.summary.changedCount + ', hủy: ' + result.summary.cancelledCount + '.\nKiểm tra tại: ' + sheetUrl });
      result.mail.sent = true;
    } else if (mode === 'apply' && result.status === 'SYNCED') {
      result.mail = notifyDirector_(result.batchId, result.summary).mail;
    } else if (mode === 'reject' && result.status === 'RETURNED') {
      MailApp.sendEmail({ to: INTAKE_SUBMITTER, subject: 'METTASOUL · Lịch trường được trả lại để sửa',
        body: 'Nguyễn Phương đã trả lại đợt ' + result.batchId + '.\nLý do: ' + result.note + '\n' + sheetUrl });
      result.mail.sent = true;
    }
  } catch (error) { result.mail.reason = error && error.message ? error.message : 'Không gửi được email.'; }
  return result;
}

function notifyDirector_(batchId, summary) {
  const batches = SpreadsheetApp.getActive().getSheetByName(INTAKE_BATCHES);
  const rows = batches.getLastRow() > 1 ? batches.getRange(2, 1, batches.getLastRow() - 1, 18).getDisplayValues() : [];
  const batch = rows.find(row => row[0] === batchId);
  if (!batch || batch[4] !== 'SYNCED') throw new Error('Đợt lịch chưa được đồng bộ vào app.');
  if (batch[16]) return { batchId, status: 'NOTIFIED', mail: { sent: true, reason: '' } };
  const counts = summary || { newCount: Number(batch[6] || 0), changedCount: Number(batch[7] || 0), cancelledCount: Number(batch[9] || 0) };
  const result = { batchId, status: 'SYNCED', mail: { sent: false, reason: '' } };
  try {
    MailApp.sendEmail({ to: INTAKE_DIRECTOR, subject: 'METTASOUL · Lịch trường đã duyệt và chuyển vào app',
      body: 'Nguyễn Phương đã xác nhận lịch và hệ thống đã đồng bộ vào app.\nMã đợt: ' + batchId + '\nMới: ' + counts.newCount + ', sửa: ' + counts.changedCount + ', hủy: ' + counts.cancelledCount + '.\n' + (counts.reviewCount ? 'Cần đối chiếu lịch giáo viên đã giao: ' + counts.reviewCount + ' tiết.\n' : '') + SpreadsheetApp.getActive().getUrl() });
    result.mail.sent = true;
    intakeApi_('POST', { mode: 'mailSent', batchId });
    result.status = 'NOTIFIED';
  } catch (error) { result.mail.reason = error && error.message ? error.message : 'Không ghi nhận được email.'; }
  return result;
}

function refreshIntakeCatalog() {
  const data = intakeApi_('GET');
  const workbook = SpreadsheetApp.getActive();
  const sheet = workbook.getSheetByName(INTAKE_CATALOG);
  const allSchools = data.schools || [];
  const allClasses = data.classes || [];
  const allPeriods = data.periods || [];
  const schools = allSchools.filter(school => allClasses.some(row => row.schoolId === school.id) && allPeriods.some(row => row.school === school.name));
  const schoolIds = new Set(schools.map(row => row.id));
  const schoolNames = new Set(schools.map(row => row.name));
  const classes = allClasses.filter(row => schoolIds.has(row.schoolId));
  const periods = allPeriods.filter(row => schoolNames.has(row.school));
  const total = Math.max(schools.length, classes.length, periods.length, 5);
  const rows = [];
  for (let i = 0; i < total; i++) {
    const school = schools[i] || {}, classroom = classes[i] || {}, period = periods[i] || {};
    const parent = schools.find(item => item.id === classroom.schoolId);
    rows.push([school.name || '', school.id || '', '', parent ? parent.name : '', classroom.grade || '', classroom.name || '', classroom.id || '', '',
      period.school || '', period.session || '', period.label || '', period.start || '', period.end || '',
      period.school ? period.school + '|' + period.session + '|' + period.label : '', '',
      ['Trong lớp', 'Ngoài sân', 'Nhà thi đấu', 'Hội trường', 'Báo cáo chuyên đề'][i] || '', ['Dạy', 'Trường hủy tiết'][i] || '']);
  }
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).clearContent();
  sheet.getRange(2, 1, rows.length, 17).setValues(rows);
  const input = workbook.getSheetByName(INTAKE_INPUT);
  input.getRange(2, 3, input.getMaxRows() - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sheet.getRange(2, 1, schools.length, 1), true).setAllowInvalid(false).build());
  const overview = workbook.getSheetByName('Tổng quan');
  if (overview) overview.getRange(21, 2, 2, 1).setValues([
    [Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm')],
    [schools.length + ' trường · ' + classes.length + ' lớp · ' + periods.length + ' khung giờ'],
  ]);
  workbook.toast('Đã cập nhật ' + schools.length + ' trường, ' + classes.length + ' lớp, ' + periods.length + ' tiết.', 'Danh mục', 8);
  return { schools: schools.length, classes: classes.length, periods: periods.length };
}

function onEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== INTAKE_INPUT || e.range.getRow() < 2) return;
  const input = e.range.getSheet(), catalog = e.source.getSheetByName(INTAKE_CATALOG);
  const entries = catalog.getLastRow() > 1 ? catalog.getRange(2, 1, catalog.getLastRow() - 1, 17).getDisplayValues() : [];
  const changed = e.range.getColumn();
  const singleColumn = e.range.getNumColumns() === 1;
  for (let number = e.range.getRow(); number < e.range.getRow() + e.range.getNumRows(); number++) {
    const row = input.getRange(number, 1, 1, 20).getDisplayValues()[0];
    if (singleColumn && changed === 3) { input.getRange(number, 4, 1, 4).clearContent(); row[3] = row[4] = row[5] = row[6] = ''; }
    if (singleColumn && changed === 4) { input.getRange(number, 5).clearContent(); row[4] = ''; }
    if (singleColumn && changed === 6) { input.getRange(number, 7).clearContent(); row[6] = ''; }
    const grades = [...new Set(entries.filter(x => x[3] === row[2]).map(x => x[4]).filter(Boolean))];
    if (row[3] && !grades.includes(row[3])) { input.getRange(number, 4, 1, 2).clearContent(); row[3] = row[4] = ''; }
    const classes = entries.filter(x => x[3] === row[2] && x[4] === row[3]).map(x => x[5]).filter(Boolean);
    if (row[4] && !classes.includes(row[4])) { input.getRange(number, 5).clearContent(); row[4] = ''; }
    const sessions = [...new Set(entries.filter(x => x[8] === row[2]).map(x => x[9]).filter(Boolean))];
    if (row[5] && !sessions.includes(row[5])) { input.getRange(number, 6, 1, 2).clearContent(); row[5] = row[6] = ''; }
    const periods = entries.filter(x => x[8] === row[2] && x[9] === row[5]).map(x => x[10]).filter(Boolean);
    if (row[6] && !periods.includes(row[6])) { input.getRange(number, 7).clearContent(); row[6] = ''; }
    intakeDropdown_(input.getRange(number, 4), grades, 'Chọn trường trước để xem khối.');
    intakeDropdown_(input.getRange(number, 5), classes, 'Chọn trường và khối trước để xem lớp.');
    intakeDropdown_(input.getRange(number, 6), sessions, 'Chọn trường trước để xem buổi có lịch.');
    intakeDropdown_(input.getRange(number, 7), periods, 'Chọn trường và buổi trước để xem tiết.');
    if (!row[10] && (row[1] || row[2])) input.getRange(number, 11).setValue('Dạy');
    if (changed <= 12 && changed + e.range.getNumColumns() > 1) {
      input.getRange(number, 16).clearContent();
      if (['Chờ Nguyễn Phương duyệt', 'Đã đồng bộ'].includes(row[16])) input.getRange(number, 17).setValue('Đã sửa · cần gửi lại');
      input.getRange(number, 19).setValue(new Date());
    }
  }
}

function intakeDropdown_(cell, values, hint) {
  const rule = SpreadsheetApp.newDataValidation().setAllowInvalid(false).setHelpText(hint);
  cell.setDataValidation((values.length ? rule.requireValueInList([...new Set(values)], true) : rule.requireFormulaSatisfied('=FALSE')).build());
}
