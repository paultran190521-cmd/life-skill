// Reuse the established no-network SSR fixture, without the obsolete pre-feature snapshot.
const fs = require('node:fs');
const harness = fs.readFileSync('scripts/test-menu-rendering.cjs', 'utf8')
  .split('const Before=')[0]
  .replace(/^const baseline = .*;$/m, '');
eval(harness + `
fixture.hrmIntegrationConfigured=true;
const App = loadApp(fs.readFileSync(appPath,'utf8'));
function render() { return renderToStaticMarkup(React.createElement(App)); }
fixture.currentUserId='admin'; fixture.activeTab='activities';
assert.match(render(), /Duyệt hoàn thành chuyên đề/);
assert.match(render(), /Báo cáo tiết bị hủy/);
assert.ok(render().includes('Kiểm tra kết nối HRM (chỉ đọc)'));
fixture.activeTab='assignment';
assert.match(render(), /Môi trường: Báo cáo chuyên đề/);
fixture.currentUserId='teacher'; fixture.activeTab='attendance';
assert.match(render(), /Bị hủy tiết/);
fixture.schedules[0].teachingEnvironment='schoolyard_report';
fixture.schedules[0].activityTypeCode='STUDENT_TOPIC_REPORT_SUPPORT';
fixture.timeSlots[0].start='00:00'; fixture.timeSlots[0].end='00:01';
fixture.hrmIntegrationConfigured=true;
assert.match(render(), /Hoàn thành/);
const modal=fs.readFileSync(appPath,'utf8');
assert.match(modal, /aria-label="Lý do tiết bị hủy"/);
assert.match(modal, /Xác nhận bị hủy/);
assert.ok(!modal.includes('Tiết này sẽ không được tính tiền'));
console.log('Topic UI SSR checks passed: admin approval/report panels, renamed environment, completion and cancellation controls. No network/database writes.');
`);
