import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

type SchoolRow = { id: string; name: string };
type ClassRow = { id: string; schoolId: string; grade: string; name: string };
type SlotRow = { id: string; label: string; start: string; end: string; active?: boolean };
type CatalogPeriod = { school: string; session: "Sáng" | "Chiều"; label: string; start: string; end: string };
type NamedRange = { name: string; column: string; first: number; last: number };

export type SchoolNeedTemplateCatalog = {
  schools: string[];
  grades: Array<{ school: string; grade: string }>;
  classes: Array<{ key: string; className: string }>;
  periods: CatalogPeriod[];
  names: NamedRange[];
};

const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

export function buildSchoolNeedTemplateCatalog(
  schools: SchoolRow[],
  classes: ClassRow[],
  slots: SlotRow[],
  isAllowed: (slot: SlotRow, schoolName: string) => boolean,
  isDouble: (slot: SlotRow) => boolean,
  options?: { includeDouble?: boolean },
): SchoolNeedTemplateCatalog {
  const activeSchools = schools.filter((row) => row.id && row.name).slice().sort((a, b) => collator.compare(a.name, b.name));
  const names: NamedRange[] = [];
  const grades: SchoolNeedTemplateCatalog["grades"] = [];
  const classOptions: SchoolNeedTemplateCatalog["classes"] = [];
  const periods: CatalogPeriod[] = [];
  activeSchools.forEach((school, schoolPosition) => {
    const schoolIndex = schoolPosition + 1;
    const schoolClasses = classes.filter((row) => row.schoolId === school.id && row.name && row.grade);
    const schoolGrades = Array.from(new Set(schoolClasses.map((row) => row.grade))).sort(collator.compare);
    const gradeFirst = grades.length + 2;
    schoolGrades.forEach((grade, gradePosition) => {
      grades.push({ school: school.name, grade });
      const classFirst = classOptions.length + 2;
      schoolClasses.filter((row) => row.grade === grade).sort((a, b) => collator.compare(a.name, b.name))
        .forEach((row) => classOptions.push({ key: `${school.name}|${grade}`, className: row.name }));
      if (classOptions.length + 1 >= classFirst) names.push({ name: `CLASSES_${schoolIndex}_${gradePosition + 1}`, column: "G", first: classFirst, last: classOptions.length + 1 });
    });
    if (grades.length + 1 >= gradeFirst) names.push({ name: `GRADES_${schoolIndex}`, column: "D", first: gradeFirst, last: grades.length + 1 });
    (["Sáng", "Chiều"] as const).forEach((session, sessionPosition) => {
      const available = slots.filter((slot) => slot.active !== false && isAllowed(slot, school.name) && (options?.includeDouble || !isDouble(slot)) &&
        (slot.start < "12:00" ? "Sáng" : "Chiều") === session)
        .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
      const labelCounts = new Map<string, number>();
      for (const slot of available) {
        const label = slot.label.includes(" - ") ? slot.label.split(" - ").slice(1).join(" - ").trim() : slot.label.trim();
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }
      const periodFirst = periods.length + 2;
      available.forEach((slot) => {
        const base = slot.label.includes(" - ") ? slot.label.split(" - ").slice(1).join(" - ").trim() : slot.label.trim();
        periods.push({ school: school.name, session, label: (labelCounts.get(base) || 0) > 1 ? `${base} · ${slot.start}–${slot.end}` : base, start: slot.start, end: slot.end });
      });
      if (periods.length + 1 >= periodFirst) names.push({ name: `PERIODS_${schoolIndex}_${sessionPosition + 1}`, column: "J", first: periodFirst, last: periods.length + 1 });
    });
  });
  names.unshift(
    { name: "SCHOOLS", column: "A", first: 2, last: activeSchools.length + 1 },
    { name: "SESSIONS", column: "P", first: 2, last: 3 },
    { name: "ENVIRONMENTS", column: "Q", first: 2, last: 6 },
  );
  return { schools: activeSchools.map((row) => row.name), grades, classes: classOptions, periods, names };
}

export function schoolNeedCatalogRows(catalog: SchoolNeedTemplateCatalog) {
  const length = Math.max(catalog.schools.length, catalog.grades.length, catalog.classes.length, catalog.periods.length, 5);
  const rows: string[][] = [["Trường", "", "Trường", "Khối", "", "Trường|Khối", "Lớp", "", "Trường|Buổi", "Tiết", "", "Trường|Buổi|Tiết", "Bắt đầu", "Kết thúc", "", "Buổi", "Môi trường"]];
  for (let i = 0; i < length; i++) {
    const period = catalog.periods[i];
    rows.push([
      catalog.schools[i] || "", "", catalog.grades[i]?.school || "", catalog.grades[i]?.grade || "", "",
      catalog.classes[i]?.key || "", catalog.classes[i]?.className || "", "",
      period ? `${period.school}|${period.session}` : "", period?.label || "", "",
      period ? `${period.school}|${period.session}|${period.label}` : "", period?.start || "", period?.end || "", "",
      ["Sáng", "Chiều"][i] || "", ["Trong lớp", "Ngoài sân", "Nhà thi đấu", "Hội trường", "Báo cáo chuyên đề"][i] || "",
    ]);
  }
  return rows;
}

export function schoolNeedTimeFormula(row: number, column: "M" | "N", catalog: SchoolNeedTemplateCatalog) {
  const last = catalog.periods.length + 1;
  return `IF(OR($C${row}="",$F${row}="",$G${row}=""),"",IFERROR(INDEX('Danh muc'!$${column}$2:$${column}$${last},MATCH($C${row}&"|"&$F${row}&"|"&$G${row},'Danh muc'!$L$2:$L$${last},0)),""))`;
}

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Adds native Excel validations/defined names to the workbook produced by the spreadsheet writer. */
export function addSchoolNeedTemplateControls(bytes: Uint8Array, catalog: SchoolNeedTemplateCatalog) {
  const files = unzipSync(bytes);
  const workbookPath = "xl/workbook.xml";
  const sheetPath = "xl/worksheets/sheet1.xml";
  const workbookXml = strFromU8(files[workbookPath]);
  const sheetXml = strFromU8(files[sheetPath]);
  if (!workbookXml || !sheetXml || /<(?:\w+:)?definedNames\b/.test(workbookXml) || /<(?:\w+:)?dataValidations\b/.test(sheetXml)) throw new Error("Không thể thêm danh sách chọn vào file Excel.");
  const workbookPrefix = /<([\w]+:)?workbook\b/.exec(workbookXml)?.[1] || "";
  const sheetPrefix = /<([\w]+:)?worksheet\b/.exec(sheetXml)?.[1] || "";
  const definedNames = catalog.names.map((range) => `<${workbookPrefix}definedName name="${range.name}">'Danh muc'!$${range.column}$${range.first}:$${range.column}$${range.last}</${workbookPrefix}definedName>`).join("");
  const closingWorkbook = `</${workbookPrefix}workbook>`;
  const calcSettings = /<(?:\w+:)?calcPr\b/.test(workbookXml) ? "" : `<${workbookPrefix}calcPr calcId="0" fullCalcOnLoad="1"/>`;
  const nextWorkbook = workbookXml.replace(closingWorkbook, `<${workbookPrefix}definedNames>${definedNames}</${workbookPrefix}definedNames>${calcSettings}${closingWorkbook}`);
  const list = (sqref: string, formula: string, message: string) => `<${sheetPrefix}dataValidation type="list" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Chọn từ danh sách" error="${xmlEscape(message)}" sqref="${sqref}"><${sheetPrefix}formula1>${xmlEscape(formula)}</${sheetPrefix}formula1></${sheetPrefix}dataValidation>`;
  const validations = [
    `<${sheetPrefix}dataValidation type="date" operator="between" allowBlank="1" showErrorMessage="1" errorStyle="stop" errorTitle="Ngày không hợp lệ" error="Hãy nhập một ngày hợp lệ." sqref="B2:B1001"><${sheetPrefix}formula1>DATE(2020,1,1)</${sheetPrefix}formula1><${sheetPrefix}formula2>DATE(2100,12,31)</${sheetPrefix}formula2></${sheetPrefix}dataValidation>`,
    list("C2:C1001", "SCHOOLS", "Hãy chọn trường có trong danh mục."),
    list("D2:D1001", `INDIRECT("GRADES_"&MATCH($C2,SCHOOLS,0))`, "Hãy chọn khối của trường."),
    list("E2:E1001", `INDIRECT("CLASSES_"&MATCH($C2,SCHOOLS,0)&"_"&MATCH($D2,INDIRECT("GRADES_"&MATCH($C2,SCHOOLS,0)),0))`, "Hãy chọn lớp thuộc khối."),
    list("F2:F1001", "SESSIONS", "Hãy chọn Sáng hoặc Chiều."),
    list("G2:G1001", `INDIRECT("PERIODS_"&MATCH($C2,SCHOOLS,0)&"_"&MATCH($F2,SESSIONS,0))`, "Hãy chọn tiết của trường và buổi."),
    list("J2:J1001", "ENVIRONMENTS", "Hãy chọn môi trường dạy."),
  ];
  const validationXml = `<${sheetPrefix}dataValidations count="${validations.length}">${validations.join("")}</${sheetPrefix}dataValidations>`;
  const insertion = /<(?:\w+:)?(?:hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|drawing|legacyDrawing|extLst)\b/;
  const match = insertion.exec(sheetXml);
  const closingSheet = `</${sheetPrefix}worksheet>`;
  const nextSheet = match ? sheetXml.slice(0, match.index) + validationXml + sheetXml.slice(match.index) : sheetXml.replace(closingSheet, `${validationXml}${closingSheet}`);
  if (nextWorkbook === workbookXml || nextSheet === sheetXml) throw new Error("File Excel không có cấu trúc trang tính mong đợi.");
  files[workbookPath] = strToU8(nextWorkbook);
  files[sheetPath] = strToU8(nextSheet);
  return zipSync(files, { level: 6 });
}
