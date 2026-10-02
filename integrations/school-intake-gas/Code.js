const INTAKE_INPUT = 'Nhập lịch';
const INTAKE_CATALOG = 'Danh mục';
const INTAKE_BATCHES = 'Đợt duyệt';
const INTAKE_OWNER = 'paultran190521@gmail.com';
const INTAKE_EMAIL_CHOICES = [
  { email: INTAKE_OWNER, label: 'Chủ Sheet · thử nghiệm' },
  { email: 'mynhung.ipale@gmail.com', label: 'Mỹ Nhung' },
  { email: 'nguyenphuong.ipale@gmail.com', label: 'Nguyễn Phương' },
  { email: 'dangphuongvietnam@gmail.com', label: 'Sunny · giám đốc' },
];
const INTAKE_API_BASE = 'https://giaovukns.mettasoul.vn';
const INTAKE_FIRST_DATA_ROW = 6;

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Xác nhận lịch')
    .addItem('Mở thao tác theo vai trò', 'openIntakeSidebar')
    .addItem('Kích hoạt nút gửi / duyệt trên bảng', 'installIntakeActionTrigger')
    .addItem('Áp dụng bộ lọc đầu bảng', 'applyIntakeFilters')
    .addItem('Xóa bộ lọc', 'clearIntakeFilters')
    .addItem('Cập nhật trường, lớp và tiết từ app', 'refreshIntakeCatalog')
    .addItem('Làm mới danh sách chọn của lịch đã nhập', 'refreshIntakeDropdowns')
    .addToUi();
  try { warmIntakeCatalogCache_(); } catch (_) { /* The dropdown still loads on first edit. */ }
}

function openIntakeSidebar() {
  SpreadsheetApp.getUi().showSidebar(HtmlService.createHtmlOutputFromFile('Approval').setTitle('Xác nhận lịch trường'));
}

function installIntakeActionTrigger() {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  const settings = intakeSettings_();
  if (![settings.submitter, settings.reviewer].includes(email)) throw new Error('Email này không được giao vòng gửi hoặc duyệt lịch.');
  const workbook = SpreadsheetApp.getActive();
  const installed = ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'handleIntakeActionEdit' && trigger.getTriggerSourceId() === workbook.getId());
  if (!installed) ScriptApp.newTrigger('handleIntakeActionEdit').forSpreadsheet(workbook).onEdit().create();
  workbook.toast(installed ? 'Nút thao tác đã được kích hoạt cho email này.' : 'Đã kích hoạt nút thao tác cho email này.', 'Xác nhận lịch', 7);
}

function handleIntakeActionEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== INTAKE_INPUT || e.range.getRow() !== 3 || ![8, 9].includes(e.range.getColumn()) || e.value !== 'TRUE') return;
  const cell = e.range, mode = cell.getColumn() === 8 ? 'submit' : 'apply';
  const email = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
  const editor = e.user && e.user.getEmail ? String(e.user.getEmail() || '').trim().toLowerCase() : '';
  const workbook = e.source, input = cell.getSheet();
  const settings = intakeSettings_();
  if (email !== (mode === 'submit' ? settings.submitter : settings.reviewer) || (editor && editor !== email)) return;
  try {
    const weekStart = String(input.getRange('D3').getDisplayValue() || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('Hãy chọn một tuần cụ thể ở ô D3 trước khi thao tác.');
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(15000)) throw new Error('Đang có thao tác xác nhận khác. Vui lòng thử lại.');
    let result;
    try {
      const context = intakeContextForEmail_(email);
      const batch = mode === 'apply' ? context.pending.find(row => row.weekStart === weekStart) : null;
      if (mode === 'apply' && !batch) throw new Error('Tuần này chưa có đợt chờ duyệt vòng 2.');
      const school = String(input.getRange('F3').getDisplayValue() || 'Tất cả').trim();
      result = intakeActionUnlocked_({ mode, school, weekStart, batchId: batch ? batch.id : '' }, email);
    } finally { lock.releaseLock(); }
    const summary = result.summary || {};
    const detail = `${mode === 'submit' ? 'Đã gửi vòng 1' : 'Đã duyệt vào app'} · ${summary.schoolCount || 0} trường · ${summary.rowCount || 0} tiết. Mới ${summary.newCount || 0}, sửa ${summary.changedCount || 0}, trùng ${summary.duplicateCount || 0}, hủy ${summary.cancelledCount || 0}.`;
    cell.setNote(detail + (result.mail && !result.mail.sent ? '\nEmail: ' + (result.mail.reason || 'chưa gửi được') : ''));
    workbook.toast(detail, 'Xác nhận lịch', 10);
  } catch (error) {
    const message = error && error.message ? error.message : 'Không xử lý được thao tác.';
    cell.setNote('Chưa thực hiện: ' + message);
    workbook.toast(message, 'Chưa thực hiện', 10);
  } finally { cell.setValue(false); }
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

function intakeSettings_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName('Cấu hình duyệt');
  if (!sheet) throw new Error('Chưa có tab Cấu hình duyệt.');
  const values = sheet.getRange('B2:B4').getDisplayValues().map(row => String(row[0] || '').trim().toLowerCase());
  const allowed = new Set(INTAKE_EMAIL_CHOICES.map(item => item.email));
  if (values.some(email => !allowed.has(email)) || values.slice(0, 2).includes('dangphuongvietnam@gmail.com')) throw new Error('Email duyệt lịch chưa thuộc danh sách được phép. Chủ Sheet cần kiểm tra cấu hình.');
  return { submitter: values[0], reviewer: values[1], director: values[2] };
}

function protectIntakeActionCells_(settings) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(INTAKE_INPUT);
  [{ address: 'H3', email: settings.submitter, label: 'Vòng 1 gửi lịch' },
    { address: 'I3', email: settings.reviewer, label: 'Vòng 2 duyệt lịch' }].forEach(item => {
    const range = sheet.getRange(item.address);
    let protection = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE)
      .find(rule => rule.getDescription() === 'INTAKE_ACTION:' + item.address);
    if (!protection) protection = range.protect().setDescription('INTAKE_ACTION:' + item.address);
    const allowed = new Set([INTAKE_OWNER, item.email]);
    protection.addEditors([...allowed]);
    protection.getEditors().forEach(editor => {
      const email = String(editor.getEmail() || '').toLowerCase();
      if (email && !allowed.has(email)) protection.removeEditor(editor);
    });
    if (protection.canDomainEdit()) protection.setDomainEdit(false);
  });
}

function intakeSaveSettings(input) {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (email !== INTAKE_OWNER) throw new Error('Chỉ chủ Google Sheet được đổi email của các vai trò.');
  const allowed = new Map(INTAKE_EMAIL_CHOICES.map(item => [item.email, item.label]));
  const settings = {
    submitter: String(input.submitter || '').trim().toLowerCase(),
    reviewer: String(input.reviewer || '').trim().toLowerCase(),
    director: String(input.director || '').trim().toLowerCase(),
  };
  if (Object.keys(settings).some(key => !allowed.has(settings[key]))) throw new Error('Hãy chọn email trong danh sách người đã có quyền truy cập.');
  if ([settings.submitter, settings.reviewer].includes('dangphuongvietnam@gmail.com')) throw new Error('Email giám đốc hiện chỉ có quyền xem Sheet, không thể nhập hoặc duyệt lịch.');
  if (settings.submitter === settings.reviewer && settings.submitter !== INTAKE_OWNER) throw new Error('Chỉ chủ Sheet được dùng chung email cho hai vòng khi thử nghiệm.');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Đang có thao tác xác nhận khác. Vui lòng thử lại.');
  try {
    const updatedAt = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss');
    SpreadsheetApp.getActive().getSheetByName('Cấu hình duyệt').getRange('B2:E4').setValues(
      [settings.submitter, settings.reviewer, settings.director].map(value => [value, allowed.get(value), updatedAt, email]));
    protectIntakeActionCells_(settings);
    return { settings, updatedAt };
  } finally { lock.releaseLock(); }
}

function intakeContext() {
  return intakeContextForEmail_(String(Session.getActiveUser().getEmail() || '').trim().toLowerCase());
}

function intakeContextForEmail_(email) {
  const settings = intakeSettings_();
  const canSubmit = email === settings.submitter, canReview = email === settings.reviewer, canConfigure = email === INTAKE_OWNER;
  if (!canSubmit && !canReview && !canConfigure) throw new Error('Tài khoản Google này không được phép xác nhận lịch.');
  const workbook = SpreadsheetApp.getActive();
  const catalog = workbook.getSheetByName(INTAKE_CATALOG);
  const schools = catalog.getLastRow() > 1 ? catalog.getRange(2, 1, catalog.getLastRow() - 1, 1).getDisplayValues().map(row => row[0]).filter(Boolean) : [];
  const batches = workbook.getSheetByName(INTAKE_BATCHES);
  const all = batches.getLastRow() > 1 ? batches.getRange(2, 1, batches.getLastRow() - 1, 18).getDisplayValues() : [];
  const pending = all.filter(row => row[4] === 'WAITING_REVIEW').map(row => ({ id: row[0], school: row[1], weekStart: row[2], count: row[5] }));
  const unnotified = all.filter(row => row[4] === 'SYNCED' && !row[16]).map(row => ({ id: row[0], school: row[1], weekStart: row[2], count: row[5] }));
  const input = workbook.getSheetByName(INTAKE_INPUT);
  const selected = input.getRange('B3:F3').getDisplayValues()[0];
  const locks = workbook.getSheetByName('Khóa tuần');
  const lockedWeeks = {};
  if (locks && locks.getLastRow() > 1) locks.getRange(2, 1, locks.getLastRow() - 1, 2).getDisplayValues().forEach(row => { if (row[0]) lockedWeeks[row[0]] = row[1] === 'LOCKED'; });
  const weeks = new Set(Object.keys(lockedWeeks));
  if (/^\d{4}-\d{2}$/.test(selected[0])) {
    const [year, month] = selected[0].split('-').map(Number);
    const cursor = new Date(Date.UTC(year, month - 1, 1));
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    while (cursor.getTime() < Date.UTC(year, month, 1)) {
      weeks.add(Utilities.formatDate(cursor, 'UTC', 'yyyy-MM-dd'));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }
  if (input.getLastRow() >= INTAKE_FIRST_DATA_ROW) input.getRange(INTAKE_FIRST_DATA_ROW, 2, input.getLastRow() - INTAKE_FIRST_DATA_ROW + 1, 1).getValues().forEach(row => {
    if (!(row[0] instanceof Date)) return;
    const day = new Date(row[0].getTime());
    day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
    weeks.add(Utilities.formatDate(day, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd'));
  });
  if (/^\d{4}-\d{2}-\d{2}$/.test(selected[2])) weeks.add(selected[2]);
  return { email, role: canSubmit && canReview ? 'both' : canSubmit ? 'submitter' : canReview ? 'reviewer' : 'owner',
    canSubmit, canReview, canConfigure, settings, emailChoices: INTAKE_EMAIL_CHOICES, schools, pending, unnotified,
    selection: { month: selected[0], weekStart: selected[2], school: selected[4] }, lockedWeeks,
    weeks: [...weeks].sort().reverse().map(day => ({ value: day, label: academicWeekLabel_(day) + ' · ' + day })) };
}

function intakeAction(input) {
  const mode = String(input.mode || '');
  if (mode === 'preview') return intakeActionUnlocked_(input);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw new Error('Một thao tác xác nhận khác đang chạy. Vui lòng thử lại sau.');
  try { return intakeActionUnlocked_(input); } finally { lock.releaseLock(); }
}

function intakeActionUnlocked_(input, actorEmail) {
  const context = actorEmail ? intakeContextForEmail_(actorEmail) : intakeContext();
  const mode = String(input.mode || '');
  if (mode === 'submit' && !context.canSubmit) throw new Error('Chỉ email được chỉ định cho vòng 1 mới có thể gửi lịch.');
  if (['apply', 'reject', 'notify', 'lockWeek', 'unlockWeek'].includes(mode) && !context.canReview) throw new Error('Chỉ email được chỉ định cho vòng 2 mới có thể duyệt hoặc khóa tuần.');
  if (mode === 'notify') return notifyDirector_(String(input.batchId || ''));
  const result = intakeApi_('POST', { mode, school: input.school || '', weekStart: input.weekStart || '', batchId: input.batchId || '', note: input.note || '' });
  if (mode === 'lockWeek' || mode === 'unlockWeek') { applyIntakeFilters(); return result; }
  result.mail = { sent: false, reason: '' };
  try {
    const sheetUrl = SpreadsheetApp.getActive().getUrl();
    if (mode === 'submit' && result.batchId) {
      sendIntakeEmail_(context.settings.reviewer, 'METTASOUL · Lịch trường chờ duyệt vòng 2', {
        title: 'Lịch trường chờ duyệt vòng 2', badge: 'CẦN KIỂM TRA',
        intro: context.email + ' đã gửi lịch để bạn kiểm tra và xác nhận.',
        account: context.settings.reviewer, week: input.weekStart, batchId: result.batchId,
        summary: result.summary, action: 'Mở bảng lịch để duyệt', url: sheetUrl,
        instruction: 'Chọn đúng tuần ở đầu tab Nhập lịch, kiểm tra các dòng và bấm xác nhận vòng 2.',
      });
      result.mail.sent = true;
    } else if (mode === 'apply' && result.status === 'SYNCED') {
      const notification = notifyDirector_(result.batchId, result.summary, true, context.email);
      result.mail = notification.mail;
      if (notification.status === 'NOTIFIED') result.status = 'NOTIFIED';
    } else if (mode === 'reject' && result.status === 'RETURNED') {
      sendIntakeEmail_(context.settings.submitter, 'METTASOUL · Lịch trường được trả lại để sửa', {
        title: 'Lịch trường cần chỉnh sửa', badge: 'ĐƯỢC TRẢ LẠI',
        intro: context.email + ' đã trả lại đợt lịch để bạn cập nhật.',
        account: context.settings.submitter, week: input.weekStart, batchId: result.batchId,
        summary: result.summary, note: result.note, action: 'Mở bảng lịch để sửa', url: sheetUrl,
        instruction: 'Sửa các dòng cần thiết trên tab Nhập lịch, sau đó gửi lại vòng 1.',
      });
      result.mail.sent = true;
    }
  } catch (error) { result.mail.reason = error && error.message ? error.message : 'Không gửi được email.'; }
  return result;
}

function notifyDirector_(batchId, summary, trustedSynced, actorEmail) {
  const batches = SpreadsheetApp.getActive().getSheetByName(INTAKE_BATCHES);
  const rows = batches.getLastRow() > 1 ? batches.getRange(2, 1, batches.getLastRow() - 1, 18).getDisplayValues() : [];
  const index = rows.findIndex(row => row[0] === batchId);
  const batch = rows[index];
  if (!batch || (!trustedSynced && batch[4] !== 'SYNCED')) throw new Error('Đợt lịch chưa được đồng bộ vào app.');
  if (batch[16]) return { batchId, status: 'NOTIFIED', mail: { sent: true, reason: '' } };
  const counts = summary || { rowCount: Number(batch[5] || 0), newCount: Number(batch[6] || 0), changedCount: Number(batch[7] || 0), duplicateCount: Number(batch[8] || 0), cancelledCount: Number(batch[9] || 0) };
  const result = { batchId, status: 'SYNCED', mail: { sent: false, reason: '' } };
  try {
    sendIntakeEmail_(intakeSettings_().director, 'METTASOUL · Lịch trường đã duyệt và chuyển vào app', {
      title: 'Lịch trường đã chuyển vào METTASOUL', badge: 'ĐÃ ĐỒNG BỘ',
      intro: (actorEmail || String(Session.getActiveUser().getEmail() || '')) + ' đã xác nhận lịch vòng 2. Đây là email thông tin; bạn không cần duyệt thêm.',
      account: intakeSettings_().director, week: batch[2], batchId,
      summary: counts, note: counts.reviewCount ? 'Cần đối chiếu ' + counts.reviewCount + ' tiết đã giao giáo viên.' : '',
      action: 'Xem lịch đã duyệt', url: SpreadsheetApp.getActive().getUrl(),
      instruction: 'Lịch đã vào app. Giáo vụ tiếp tục chọn giáo viên và gửi lịch từ METTASOUL.',
    });
    result.mail.sent = true;
    batches.getRange(index + 2, 17).setValue(new Date());
    SpreadsheetApp.flush();
    result.status = 'NOTIFIED';
  } catch (error) { result.mail.reason = error && error.message ? error.message : 'Không ghi nhận được email.'; }
  return result;
}

function sendIntakeEmail_(to, subject, details) {
  const clean = value => String(value == null ? '' : value);
  const escapeHtml = value => clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const counts = details.summary || {};
  const number = value => value == null || value === '' ? '—' : Number(value);
  const metrics = [
    ['Trường', number(counts.schoolCount)], ['Tiết', number(counts.rowCount)],
    ['Mới', number(counts.newCount)], ['Sửa', number(counts.changedCount)],
    ['Trùng', number(counts.duplicateCount)], ['Hủy', number(counts.cancelledCount)],
  ];
  const sheetUrl = clean(details.url).split('#')[0] + '#gid=0';
  const body = [
    'METTASOUL | ' + clean(details.title), '', clean(details.intro), '',
    'MỞ BẰNG TÀI KHOẢN GOOGLE: ' + clean(details.account),
    'Đây là email đã được cấp quyền truy cập. Nếu đang đăng nhập nhiều tài khoản, hãy chuyển sang email này trước khi mở liên kết.', '',
    'Tuần bắt đầu: ' + clean(details.week), 'Mã đợt: ' + clean(details.batchId),
    metrics.map(item => item[0] + ': ' + item[1]).join(' · '),
    details.note ? 'Ghi chú: ' + clean(details.note) : '',
    clean(details.instruction), clean(details.action) + ': ' + sheetUrl,
  ].filter(line => line !== '').join('\n');
  const cards = metrics.map((item, index) => (index === 3 ? '</tr><tr>' : '') + '<td style="width:33%;padding:10px 12px;border:1px solid #dbe7ed;border-radius:10px;text-align:center;background:#f5fafb"><strong style="display:block;font-size:20px;color:#0c5269">' + escapeHtml(item[1]) + '</strong><span style="font-size:12px;color:#526672">' + escapeHtml(item[0]) + '</span></td>').join('');
  const htmlBody = '<div style="margin:0;padding:28px 12px;background:#edf5f7;font-family:Arial,sans-serif;color:#17394a">' +
    '<div style="max-width:640px;margin:auto;background:#ffffff;border:1px solid #d7e9ed;border-radius:18px;overflow:hidden">' +
    '<div style="background:#0b7287;padding:22px 28px;color:#ffffff"><div style="font-size:13px;letter-spacing:2px;font-weight:bold">METTASOUL</div><div style="font-size:13px;margin-top:5px">LỊCH DẠY HẰNG TUẦN</div></div>' +
    '<div style="padding:28px"><div style="display:inline-block;padding:6px 11px;border-radius:99px;background:#e7f6ef;color:#176b4b;font-size:11px;font-weight:bold;letter-spacing:1px">' + escapeHtml(details.badge) + '</div>' +
    '<h1 style="font-size:23px;line-height:1.3;margin:16px 0 8px;color:#123e50">' + escapeHtml(details.title) + '</h1>' +
    '<p style="font-size:14px;line-height:1.7;color:#465e6c;margin:0 0 20px">' + escapeHtml(details.intro) + '</p>' +
    '<div style="padding:16px;border-radius:12px;background:#fff4d8;border:1px solid #f0d18b"><div style="font-size:11px;font-weight:bold;color:#8a5c12;letter-spacing:.5px">TÀI KHOẢN ĐƯỢC CẤP QUYỀN</div><div style="font-size:17px;font-weight:bold;color:#423110;margin:6px 0">' + escapeHtml(details.account) + '</div><div style="font-size:12px;line-height:1.5;color:#674b1d">Nếu đang đăng nhập nhiều tài khoản Google, hãy chuyển sang email này trước khi mở bảng lịch.</div></div>' +
    '<p style="font-size:13px;line-height:1.7;margin:20px 0 12px"><strong>Tuần bắt đầu:</strong> ' + escapeHtml(details.week) + '<br><strong>Mã đợt:</strong> ' + escapeHtml(details.batchId) + '</p>' +
    '<table role="presentation" cellspacing="5" cellpadding="0" style="width:100%;border-collapse:separate"><tr>' + cards + '</tr></table>' +
    (details.note ? '<p style="padding:12px 14px;background:#fff4f0;border-left:3px solid #d9764e;border-radius:7px;font-size:13px;line-height:1.6"><strong>Ghi chú:</strong> ' + escapeHtml(details.note) + '</p>' : '') +
    '<p style="font-size:13px;line-height:1.6;color:#465e6c;margin:20px 0">' + escapeHtml(details.instruction) + '</p>' +
    '<a href="' + escapeHtml(sheetUrl) + '" style="display:inline-block;background:#0b7287;color:#ffffff;text-decoration:none;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:bold">' + escapeHtml(details.action) + '</a>' +
    '<p style="font-size:11px;color:#718896;line-height:1.5;margin:24px 0 0">Email tự động từ quy trình nhập và duyệt lịch METTASOUL.</p></div></div></div>';
  MailApp.sendEmail({ to, subject, body, htmlBody, name: 'METTASOUL Giáo vụ' });
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
  input.getRange(INTAKE_FIRST_DATA_ROW, 3, input.getMaxRows() - INTAKE_FIRST_DATA_ROW + 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(sheet.getRange(2, 1, schools.length, 1), true).setAllowInvalid(false).build());
  input.getRange('F3').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['Tất cả'].concat(schools.map(row => row.name)), true).setAllowInvalid(false).build());
  const repaired = repairIntakeDropdowns_();
  const overview = workbook.getSheetByName('Tổng quan');
  if (overview) overview.getRange(21, 2, 2, 1).setValues([
    [Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm:ss.SSS')],
    [schools.length + ' trường · ' + classes.length + ' lớp · ' + periods.length + ' khung giờ'],
  ]);
  workbook.toast('Đã cập nhật ' + schools.length + ' trường, ' + classes.length + ' lớp, ' + periods.length + ' tiết; làm mới ' + repaired + ' dòng lịch.', 'Danh mục', 8);
  return { schools: schools.length, classes: classes.length, periods: periods.length, repaired };
}

function refreshIntakeDropdowns() {
  const repaired = repairIntakeDropdowns_();
  SpreadsheetApp.getActive().toast('Đã làm mới danh sách chọn cho ' + repaired + ' dòng; nội dung lịch và trạng thái đồng bộ được giữ nguyên.', 'Nhập lịch', 8);
  return repaired;
}

function repairIntakeDropdowns_() {
  const workbook = SpreadsheetApp.getActive();
  const input = workbook.getSheetByName(INTAKE_INPUT);
  const catalog = workbook.getSheetByName(INTAKE_CATALOG);
  if (!input || !catalog || catalog.getLastRow() < 2) return 0;
  const rows = input.getRange(INTAKE_FIRST_DATA_ROW, 3, input.getMaxRows() - INTAKE_FIRST_DATA_ROW + 1, 5).getDisplayValues();
  let count = rows.length;
  while (count && !rows[count - 1].some(Boolean)) count--;
  if (!count) return 0;
  const entries = catalog.getRange(2, 4, catalog.getLastRow() - 1, 8).getDisplayValues();
  const optionsBySchool = {};
  const rules = rows.slice(0, count).map(row => {
    const school = row[0];
    const options = optionsBySchool[school] || (optionsBySchool[school] = intakeCatalogOptionsFromEntries_(entries, school));
    return [
      intakeDropdownRule_(options.grades, 'Chọn khối thuộc trường này; nếu giá trị cũ báo đỏ, hãy kiểm tra danh mục.'),
      intakeDropdownRule_(options.classesByGrade[row[1]] || [], 'Chọn lớp thuộc trường và khối này; nếu giá trị cũ báo đỏ, hãy kiểm tra danh mục.'),
      intakeDropdownRule_(options.sessions, 'Chọn buổi có khung giờ tại trường này.'),
      intakeDropdownRule_(options.periodsBySession[row[3]] || [], 'Chọn tiết thuộc trường và buổi này; nếu giá trị cũ báo đỏ, hãy kiểm tra danh mục.'),
    ];
  });
  input.getRange(INTAKE_FIRST_DATA_ROW, 4, count, 4).setDataValidations(rules);
  return count;
}

function onEdit(e) {
  if (!e || !e.range || e.range.getSheet().getName() !== INTAKE_INPUT) return;
  if (e.range.getRow() === 3 && [2, 4, 6].includes(e.range.getColumn())) {
    if (e.range.getColumn() === 2) refreshIntakeWeekOptions_();
    applyIntakeFilters();
    return;
  }
  if (e.range.getRow() < INTAKE_FIRST_DATA_ROW) return;
  const input = e.range.getSheet();
  const changed = e.range.getColumn(), lastChanged = changed + e.range.getNumColumns() - 1;
  const singleCell = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;
  const needsDropdowns = changed <= 7 && lastChanged >= 3 && (!singleCell || [3, 4, 6].includes(changed));
  const catalogRevision = needsDropdowns ? String(e.source.getSheetByName('Tổng quan').getRange('B21').getDisplayValue()) : '';
  const firstRow = e.range.getRow(), count = e.range.getNumRows();
  const rows = input.getRange(firstRow, 1, count, 19).getDisplayValues();
  for (let offset = 0; offset < count; offset++) {
    const number = firstRow + offset, row = rows[offset];
    if (needsDropdowns) {
      const options = intakeCatalogOptions_(e.source, row[2], catalogRevision);
      const grades = options.grades, sessions = options.sessions;
      const values = row.slice(3, 7);
      if (singleCell && changed === 3) values.fill('');
      if (singleCell && changed === 4) values[1] = '';
      if (singleCell && changed === 6) values[3] = '';
      if (values[0] && !grades.includes(values[0])) { values[0] = ''; values[1] = ''; }
      const classes = options.classesByGrade[values[0]] || [];
      if (values[1] && !classes.includes(values[1])) values[1] = '';
      if (values[2] && !sessions.includes(values[2])) { values[2] = ''; values[3] = ''; }
      const periods = options.periodsBySession[values[2]] || [];
      if (values[3] && !periods.includes(values[3])) values[3] = '';
      if (values.some((value, index) => value !== row[index + 3])) input.getRange(number, 4, 1, 4).setValues([values]);
      row.splice(3, 4, ...values);
      const rules = [
        intakeDropdownRule_(grades, 'Chọn trường trước để xem khối.'),
        intakeDropdownRule_(classes, 'Chọn trường và khối trước để xem lớp.'),
        intakeDropdownRule_(sessions, 'Chọn trường trước để xem buổi có lịch.'),
        intakeDropdownRule_(periods, 'Chọn trường và buổi trước để xem tiết.'),
      ];
      input.getRange(number, 4, 1, 4).setDataValidations([rules]);
    }
    if (!row[10] && (row[1] || row[2])) input.getRange(number, 11).setValue('Dạy');
    if (changed <= 12 && changed + e.range.getNumColumns() > 1) {
      input.getRange(number, 16).clearContent();
      if (['Chờ Nguyễn Phương duyệt', 'Đã đồng bộ'].includes(row[16])) input.getRange(number, 17).setValue('Đã sửa · cần gửi lại');
      input.getRange(number, 19).setValue(new Date());
    }
  }
}

function intakeCatalogCacheKey_(school, revision) {
  return 'intake-school-' + Utilities.base64EncodeWebSafe(school).slice(0, 160) + '-' + String(revision || '').replace(/[^\d]/g, '');
}

function intakeCatalogOptions_(workbook, school, revision) {
  const empty = { grades: [], classesByGrade: {}, sessions: [], periodsBySession: {} };
  if (!school) return empty;
  const cache = CacheService.getScriptCache(), key = intakeCatalogCacheKey_(school, revision);
  const stored = cache.get(key);
  if (stored) return JSON.parse(stored);
  const catalog = workbook.getSheetByName(INTAKE_CATALOG);
  const entries = catalog.getLastRow() > 1 ? catalog.getRange(2, 4, catalog.getLastRow() - 1, 8).getDisplayValues() : [];
  const options = intakeCatalogOptionsFromEntries_(entries, school);
  const encoded = JSON.stringify(options);
  if (encoded.length < 90000) cache.put(key, encoded, 21600);
  return options;
}

function warmIntakeCatalogCache_() {
  const workbook = SpreadsheetApp.getActive();
  const catalog = workbook.getSheetByName(INTAKE_CATALOG);
  if (!catalog || catalog.getLastRow() < 2) return;
  const revision = String(workbook.getSheetByName('Tổng quan').getRange('B21').getDisplayValue());
  const entries = catalog.getRange(2, 4, catalog.getLastRow() - 1, 8).getDisplayValues();
  const schools = new Set();
  for (const row of entries) {
    if (row[0]) schools.add(row[0]);
    if (row[5]) schools.add(row[5]);
  }
  const values = {};
  for (const school of schools) {
    const encoded = JSON.stringify(intakeCatalogOptionsFromEntries_(entries, school));
    if (encoded.length < 90000) values[intakeCatalogCacheKey_(school, revision)] = encoded;
  }
  if (Object.keys(values).length) CacheService.getScriptCache().putAll(values, 21600);
}

function intakeCatalogOptionsFromEntries_(entries, school) {
  const options = { grades: [], classesByGrade: {}, sessions: [], periodsBySession: {} };
  for (const row of entries) {
    if (row[0] === school && row[1] && row[2]) {
      if (!options.classesByGrade[row[1]]) options.classesByGrade[row[1]] = [];
      if (!options.grades.includes(row[1])) options.grades.push(row[1]);
      if (!options.classesByGrade[row[1]].includes(row[2])) options.classesByGrade[row[1]].push(row[2]);
    }
    if (row[5] === school && row[6] && row[7]) {
      if (!options.periodsBySession[row[6]]) options.periodsBySession[row[6]] = [];
      if (!options.sessions.includes(row[6])) options.sessions.push(row[6]);
      if (!options.periodsBySession[row[6]].includes(row[7])) options.periodsBySession[row[6]].push(row[7]);
    }
  }
  return options;
}

function refreshIntakeWeekOptions_() {
  const input = SpreadsheetApp.getActive().getSheetByName(INTAKE_INPUT);
  const month = String(input.getRange('B3').getDisplayValue() || 'Tất cả');
  const weeks = ['Tất cả'];
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [year, part] = month.split('-').map(Number);
    const cursor = new Date(Date.UTC(year, part - 1, 1));
    cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    const stop = Date.UTC(year, part, 1);
    while (cursor.getTime() < stop) {
      weeks.push(Utilities.formatDate(cursor, 'UTC', 'yyyy-MM-dd'));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
  }
  input.getRange('D3').setValue('Tất cả').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(weeks, true).setAllowInvalid(false).build());
}

function academicWeekLabel_(weekStart) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return 'Chọn tuần để xem số tuần';
  const date = new Date(weekStart + 'T00:00:00Z');
  const thursday = new Date(date.getTime() + 3 * 86400000);
  const academicYear = thursday.getUTCMonth() >= 8 ? thursday.getUTCFullYear() : thursday.getUTCFullYear() - 1;
  const first = new Date(Date.UTC(academicYear, 8, 1));
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  const number = Math.floor((date.getTime() - first.getTime()) / (7 * 86400000)) + 1;
  return 'Tuần ' + String(number).padStart(2, '0') + ' · năm học ' + academicYear + '–' + (academicYear + 1);
}

function applyIntakeFilters() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(INTAKE_INPUT);
  const month = String(sheet.getRange('B3').getDisplayValue() || 'Tất cả');
  const week = String(sheet.getRange('D3').getDisplayValue() || 'Tất cả');
  const school = String(sheet.getRange('F3').getDisplayValue() || 'Tất cả');
  let filter = sheet.getFilter();
  if (!filter) filter = sheet.getRange(5, 1, sheet.getMaxRows() - 4, 20).createFilter();
  if (month !== 'Tất cả') filter.setColumnFilterCriteria(14, SpreadsheetApp.newFilterCriteria().whenFormulaSatisfied('=OR($N6="";$N6=IF(ISNUMBER($B$3);TEXT($B$3;"yyyy-mm");$B$3))').build());
  else filter.removeColumnFilterCriteria(14);
  if (week !== 'Tất cả') filter.setColumnFilterCriteria(13, SpreadsheetApp.newFilterCriteria().whenFormulaSatisfied('=OR($M6="";TEXT($M6;"yyyy-mm-dd")=IF(ISNUMBER($D$3);TEXT($D$3;"yyyy-mm-dd");$D$3))').build());
  else filter.removeColumnFilterCriteria(13);
  if (school !== 'Tất cả') filter.setColumnFilterCriteria(3, SpreadsheetApp.newFilterCriteria().whenFormulaSatisfied('=OR($C6="";$C6=$F$3)').build());
  else filter.removeColumnFilterCriteria(3);
  let label = academicWeekLabel_(week);
  if (week !== 'Tất cả') {
    const locks = SpreadsheetApp.getActive().getSheetByName('Khóa tuần');
    if (locks && locks.getLastRow() > 1) {
      const matching = locks.getRange(2, 1, locks.getLastRow() - 1, 2).getDisplayValues().filter(row => row[0] === week);
      label += matching.length && matching[matching.length - 1][1] === 'LOCKED' ? ' · Đã khóa' : ' · Đang mở';
    }
  }
  sheet.getRange('J3').setValue(label);
  SpreadsheetApp.getActive().toast('Đã lọc lịch theo lựa chọn đầu bảng.', 'Nhập lịch', 4);
}

function clearIntakeFilters() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(INTAKE_INPUT);
  sheet.getRange('B3').setValue('Tất cả');
  refreshIntakeWeekOptions_();
  sheet.getRange('F3').setValue('Tất cả');
  applyIntakeFilters();
}

function intakeDropdown_(cell, values, hint) {
  cell.setDataValidation(intakeDropdownRule_(values, hint));
}

function intakeDropdownRule_(values, hint) {
  const rule = SpreadsheetApp.newDataValidation().setAllowInvalid(false).setHelpText(hint);
  return (values.length ? rule.requireValueInList(values, true) : rule.requireFormulaSatisfied('=FALSE')).build();
}
