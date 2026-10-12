import assert from "node:assert/strict";
import { extractGsheetScheduleRows, isGsheetScheduleInputSheet, schoolScheduleGsheetHeaders } from "../lib/school-schedule-gsheet-import.ts";

assert.equal(isGsheetScheduleInputSheet("Nhập lịch"), true);
assert.equal(isGsheetScheduleInputSheet("Lich truong"), false);
assert.deepEqual(schoolScheduleGsheetHeaders.slice(0, 12), ["Mã dòng", "Ngày dạy", "Trường", "Khối", "Lớp", "Buổi", "Tiết", "Bắt đầu", "Kết thúc", "Môi trường", "Tình trạng", "Nguồn/Ghi chú"]);

const rows = extractGsheetScheduleRows([
  ["METTASOUL", "NHẬP LỊCH"],
  ["intake-f9582692", "05/10/2026", "TRƯỜNG THPT NAM SÀI GÒN", "Khối 2", "2/6", "Chiều", "Tiết 5 (35p)", "13:45", "14:20", "Trong lớp", "Dạy", "KNS TH"],
  ["intake-cancelled", "06/10/2026", "TRƯỜNG THPT NAM SÀI GÒN", "Khối 2", "2/7", "Chiều", "Tiết 6 (35p)", "14:25", "15:00", "Trong lớp", "Trường hủy tiết", "Trường báo hủy"],
], { readDate: (value) => String(value), readTime: (value) => String(value) });

assert.equal(rows.length, 2);
assert.deepEqual(rows[0], {
  legacySourceRowId: "intake-f9582692", date: "05/10/2026", school: "TRƯỜNG THPT NAM SÀI GÒN", grade: "Khối 2", className: "2/6", session: "Chiều", periodLabel: "Tiết 5 (35p)", start: "13:45", end: "14:20", environment: "Trong lớp", sourceStatus: "Dạy", sourceNote: "KNS TH",
});
assert.equal(rows[1].sourceStatus, "Trường hủy tiết");
console.log("Google Sheet schedule workbook mapping checks passed.");
