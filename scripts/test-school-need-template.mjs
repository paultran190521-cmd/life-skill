import assert from "node:assert/strict";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import XLSX from "xlsx-js-style";
import { addSchoolNeedTemplateControls, buildSchoolNeedTemplateCatalog, schoolNeedCatalogRows, schoolNeedTimeFormula, schoolNeedPeriodCountFormula, schoolNeedUniqueClassFormula, schoolPatternWeekdayLabel, schoolScheduleStatisticsFormulas } from "../lib/school-need-template.ts";
import { schoolNeedPeriodCount, schoolNeedPeriodTotal } from "../lib/school-need-period-count.ts";
import { canonicalSchoolTimeSlotLabel, isNamedLegacyPairSlot } from "../lib/school-time-slot-names.ts";
import { isDoubleTeachingTimeSlot, isTimeSlotAllowedForSchool } from "../lib/time-slots.ts";

const schools = [{ id: "s1", name: "Trường A" }, { id: "s2", name: "Trường B" }];
const classes = [
  { id: "c1", schoolId: "s1", grade: "Khối 1", name: "1A" },
  { id: "c2", schoolId: "s1", grade: "Khối 2", name: "2A" },
  { id: "c3", schoolId: "s2", grade: "Khối 1", name: "1B" },
];
const slots = [
  { id: "t1", label: "A - Tiết 1", start: "07:00", end: "07:45", active: true },
  { id: "t2", label: "A - Tiết 2", start: "07:50", end: "08:35", active: true },
  { id: "t3", label: "B - Tiết 1C", start: "13:00", end: "13:45", active: true },
  { id: "t4", label: "A - Tiết 1,2", start: "07:00", end: "08:35", active: true },
];
const catalog = buildSchoolNeedTemplateCatalog(schools, classes, slots, (slot, school) => slot.label.startsWith(school.slice(-1)), (slot) => slot.label.includes(","));
assert.deepEqual(catalog.schools, ["Trường A", "Trường B"]);
assert.deepEqual(catalog.grades.map((item) => item.grade), ["Khối 1", "Khối 2", "Khối 1"]);
assert.equal(catalog.periods.length, 4);
assert.deepEqual(catalog.periods.map((period) => period.label), ["Tiết 1", "Tiết 1,2", "Tiết 2", "Tiết 1C"]);
assert.deepEqual(
  buildSchoolNeedTemplateCatalog(schools, classes, [...slots].reverse(), (slot, school) => slot.label.startsWith(school.slice(-1)), (slot) => slot.label.includes(",")).periods,
  catalog.periods,
);
assert.equal(
  buildSchoolNeedTemplateCatalog(schools, classes, slots, (slot, school) => slot.label.startsWith(school.slice(-1)), (slot) => slot.label.includes(","), { includeDouble: false }).periods.length,
  3,
);
const thuDucCatalog = buildSchoolNeedTemplateCatalog(
  [{ id: "td", name: "TRƯỜNG THPT THỦ ĐỨC" }],
  [{ id: "td-class", schoolId: "td", grade: "Khối 10", name: "10A1" }],
  [{ id: "td-pair", label: "TD - Tiết 3,4C (90p)", start: "14:50", end: "16:20", active: true }],
  isTimeSlotAllowedForSchool,
  isDoubleTeachingTimeSlot,
);
assert.deepEqual(thuDucCatalog.periods.map(({ label, start, end }) => [label, start, end]), [["Tiết 3,4C (90p)", "14:50", "16:20"]]);
assert.equal(catalog.names.find((name) => name.name === "CLASSES_1_2")?.column, "G");
assert.match(schoolNeedTimeFormula(2, "M", catalog), /IF\(OR\(\$C2=""/);
assert.equal(schoolPatternWeekdayLabel("1"), "Thứ 2");
assert.equal(schoolPatternWeekdayLabel(7), "Chủ nhật");
assert.throws(() => schoolPatternWeekdayLabel("11"), /không hợp lệ/);
const weeklyFormulas = schoolScheduleStatisticsFormulas("Lich truong", 4, 1001);
assert.match(weeklyFormulas.classes, /SUMIFS\('Lich truong'!\$O\$2:\$O\$1001/);
assert.match(weeklyFormulas.classes, /\$A4/);
assert.match(weeklyFormulas.lessons, /SUMIFS\('Lich truong'!\$N\$2:\$N\$1001/);
assert.match(schoolScheduleStatisticsFormulas("Lich nen hoc ky", 4, 1001).lessons, /'Lich nen hoc ky'!/);
assert.match(schoolNeedPeriodCountFormula(2), />=70,2,1/);
assert.match(schoolNeedUniqueClassFormula(2), /COUNTIFS\(\$C\$2:\$C2/);
const minhKhaiNeeds = Array.from({ length: 15 }, (_, index) => ({ classId: `10A${index + 1}`, periodLabel: "Khung 90 phút từ 13:30", start: "13:30", end: "15:00" }));
assert.equal(new Set(minhKhaiNeeds.map((need) => need.classId)).size, 15);
assert.equal(schoolNeedPeriodTotal(minhKhaiNeeds), 30);
assert.equal(schoolNeedPeriodCount({ periodLabel: "Tiết 1C", start: "13:00", end: "13:45" }), 1);
const legacyPair = { id: "pair", label: "TĐ - Khung 90 phút từ 13:00", start: "13:00", end: "14:30", active: true };
const firstPeriod = { id: "first", label: "TĐ - Tiết 1C (45p)", start: "13:00", end: "13:45", active: true };
const renamedPair = { ...legacyPair, label: canonicalSchoolTimeSlotLabel(legacyPair, [legacyPair, firstPeriod]) };
assert.equal(renamedPair.label, "TĐ - Tiết 1, 2C (90ph)");
assert.equal(isNamedLegacyPairSlot(renamedPair, [renamedPair, firstPeriod]), true);
assert.equal(canonicalSchoolTimeSlotLabel({ id: "nsg", label: "NSG - Tiết 5, 6C (70ph)", start: "13:45", end: "15:00" }, []), "NSG - Tiết 5, 6C (70ph)");

const workbook = XLSX.utils.book_new();
const scheduleSheet = XLSX.utils.aoa_to_sheet([["ID", "Ngày", "Trường", "Khối", "Lớp", "Buổi", "Tiết", "Bắt đầu", "Kết thúc", "Môi trường", "Ghi chú", "", "", "Số tiết", "Lớp duy nhất"], ["p1", "2026-10-12", "Trường A", "Khối 1", "1A", "Sáng", "Tiết 1", "07:00", "07:45", "Trong lớp", ""], ["p2", "2026-10-12", "Trường B", "Khối 1", "1B", "Chiều", "Tiết 1, 2C", "13:00", "14:30", "Trong lớp", ""]]);
scheduleSheet.N2 = { t: "n", f: schoolNeedPeriodCountFormula(2), v: 1 };
scheduleSheet.N3 = { t: "n", f: schoolNeedPeriodCountFormula(3), v: 2 };
scheduleSheet.O2 = { t: "n", f: schoolNeedUniqueClassFormula(2), v: 1 };
scheduleSheet.O3 = { t: "n", f: schoolNeedUniqueClassFormula(3), v: 1 };
scheduleSheet["!cols"] = Array.from({ length: 13 }, () => ({ wch: 15 })).concat([{ hidden: true }, { hidden: true }]);
scheduleSheet["!autofilter"] = { ref: "A1:K1001" };
scheduleSheet["!rows"] = [{}, {}, { hidden: true }];
XLSX.utils.book_append_sheet(workbook, scheduleSheet, "Lich truong");
const summarySheet = XLSX.utils.aoa_to_sheet([["THỐNG KÊ LỊCH TUẦN"], ["Lọc trường"], ["Trường", "Số lớp", "Số tiết"], ["Trường A", "", ""], ["Trường B", "", ""]]);
summarySheet.B4 = { t: "n", f: weeklyFormulas.classes };
summarySheet.C4 = { t: "n", f: weeklyFormulas.lessons };
summarySheet.B5 = { t: "n", f: schoolScheduleStatisticsFormulas("Lich truong", 5, 1001).classes, v: 1 };
summarySheet.C5 = { t: "n", f: schoolScheduleStatisticsFormulas("Lich truong", 5, 1001).lessons, v: 2 };
summarySheet["!autofilter"] = { ref: "A3:C5" };
XLSX.utils.book_append_sheet(workbook, summarySheet, "Thong ke");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(schoolNeedCatalogRows(catalog)), "Danh muc");
const bytes = addSchoolNeedTemplateControls(new Uint8Array(XLSX.write(workbook, { bookType: "xlsx", type: "array" })), catalog);
const files = unzipSync(bytes);
const sheetXml = strFromU8(files["xl/worksheets/sheet1.xml"]);
const workbookXml = strFromU8(files["xl/workbook.xml"]);
assert.match(sheetXml, /<dataValidations count="7">/);
assert.match(sheetXml, /sqref="E2:E1001"/);
assert.match(sheetXml, /<autoFilter ref="A1:K1001"\/>/);
assert.match(workbookXml, /<definedName name="CLASSES_1_2">/);
assert.match(workbookXml, /<definedName name="_xlnm\._FilterDatabase" localSheetId="0">/);
assert.match(workbookXml, /<definedName name="_xlnm\._FilterDatabase" localSheetId="1">/);
assert.equal((workbookXml.match(/<definedNames>/g) || []).length, 1);
assert.deepEqual(XLSX.read(bytes, { type: "array" }).SheetNames, ["Lich truong", "Thong ke", "Danh muc"]);
assert.ok(XLSX.utils.sheet_to_json(XLSX.read(bytes, { type: "array" }).Sheets["Danh muc"]).some((row) => row.Tiết === "Tiết 1,2"));
assert.equal(XLSX.utils.sheet_to_json(XLSX.read(bytes, { type: "array" }).Sheets["Lich truong"]).length, 2);
assert.equal(XLSX.read(bytes, { type: "array" }).Sheets["Lich truong"].N3.v, 2);
assert.equal(XLSX.read(bytes, { type: "array" }).Sheets["Thong ke"].C5.v, 2);
assert.equal(XLSX.read(bytes, { type: "array", cellStyles: true }).Sheets["Lich truong"]["!cols"][13].hidden, true);
assert.match(strFromU8(files["xl/worksheets/sheet2.xml"]), /<autoFilter ref="A3:C5"\/>/);

// The CRM writer emits ignoredErrors. Excel removes sheet1.xml on repair when
// dataValidations are appended after it, leaving the user's exported schedule blank.
const sourceFiles = unzipSync(new Uint8Array(XLSX.write(workbook, { bookType: "xlsx", type: "array" })));
const sourceSheet = strFromU8(sourceFiles["xl/worksheets/sheet1.xml"]);
sourceFiles["xl/worksheets/sheet1.xml"] = strToU8(sourceSheet.replace(/<\/worksheet>/, '<ignoredErrors><ignoredError numberStoredAsText="1" sqref="A2:A1001"/></ignoredErrors></worksheet>'));
const repairedBytes = addSchoolNeedTemplateControls(zipSync(sourceFiles), catalog);
const repairedSheetXml = strFromU8(unzipSync(repairedBytes)["xl/worksheets/sheet1.xml"]);
assert.ok(repairedSheetXml.indexOf("<dataValidations") < repairedSheetXml.indexOf("<ignoredErrors"));
assert.equal(XLSX.utils.sheet_to_json(XLSX.read(repairedBytes, { type: "array" }).Sheets["Lich truong"]).length, 2);

const baseline = XLSX.utils.book_new();
const baselineSheet = XLSX.utils.aoa_to_sheet([
  ["Mã quy tắc (giữ khi sửa)", "Từ ngày", "Trường", "Khối", "Lớp", "Buổi", "Tiết", "Bắt đầu", "Kết thúc", "Môi trường", "Nguồn/Ghi chú", "Đến ngày", "Thứ"],
  ["rule-1", "2026-10-12", "Trường A", "Khối 1", "1A", "Sáng", "Tiết 1", "07:00", "07:45", "Trong lớp", "", "2027-01-11", "Thứ 2"],
]);
baselineSheet["!autofilter"] = { ref: "A1:M1001" };
XLSX.utils.book_append_sheet(baseline, baselineSheet, "Lich nen hoc ky");
const baselineSummary = XLSX.utils.aoa_to_sheet([["THỐNG KÊ LỊCH NỀN"], ["Lọc trường"], ["Trường", "Số lớp", "Số tiết lặp"], ["Trường A", "", ""]]);
const baselineFormulas = schoolScheduleStatisticsFormulas("Lich nen hoc ky", 4, 1001);
baselineSummary.B4 = { t: "n", f: baselineFormulas.classes };
baselineSummary.C4 = { t: "n", f: baselineFormulas.lessons };
baselineSummary["!autofilter"] = { ref: "A3:C4" };
XLSX.utils.book_append_sheet(baseline, baselineSummary, "Thong ke");
XLSX.utils.book_append_sheet(baseline, XLSX.utils.aoa_to_sheet(schoolNeedCatalogRows(catalog)), "Danh muc");
const baselineBytes = addSchoolNeedTemplateControls(new Uint8Array(XLSX.write(baseline, { bookType: "xlsx", type: "array" })), catalog);
const reopenedBaseline = XLSX.read(baselineBytes, { type: "array" });
assert.deepEqual(reopenedBaseline.SheetNames, ["Lich nen hoc ky", "Thong ke", "Danh muc"]);
assert.equal(XLSX.utils.sheet_to_json(reopenedBaseline.Sheets["Lich nen hoc ky"]).length, 1);
assert.equal(reopenedBaseline.Sheets["Lich nen hoc ky"].M2.v, "Thứ 2");
console.log("School need template catalog and Excel controls passed.");
