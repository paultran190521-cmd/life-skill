import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import XLSX from "xlsx-js-style";
import { addSchoolNeedTemplateControls, buildSchoolNeedTemplateCatalog, schoolNeedCatalogRows, schoolNeedTimeFormula } from "../lib/school-need-template.ts";

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
assert.equal(catalog.periods.length, 3);
assert.equal(catalog.names.find((name) => name.name === "CLASSES_1_2")?.column, "G");
assert.match(schoolNeedTimeFormula(2, "M", catalog), /IF\(OR\(\$C2=""/);

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["ID", "Ngày", "Trường", "Khối", "Lớp", "Buổi", "Tiết", "Bắt đầu", "Kết thúc", "Môi trường", "Ghi chú"]]), "Lich truong");
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(schoolNeedCatalogRows(catalog)), "Danh muc");
const bytes = addSchoolNeedTemplateControls(new Uint8Array(XLSX.write(workbook, { bookType: "xlsx", type: "array" })), catalog);
const files = unzipSync(bytes);
const sheetXml = strFromU8(files["xl/worksheets/sheet1.xml"]);
const workbookXml = strFromU8(files["xl/workbook.xml"]);
assert.match(sheetXml, /<dataValidations count="7">/);
assert.match(sheetXml, /sqref="E2:E1001"/);
assert.match(workbookXml, /<definedName name="CLASSES_1_2">/);
assert.equal(XLSX.read(bytes, { type: "array" }).SheetNames.length, 2);
console.log("School need template catalog and Excel controls passed.");
