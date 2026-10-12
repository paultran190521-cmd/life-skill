import type { SchoolNeedInput } from "@/lib/school-teaching-needs";

/**
 * The operational fields used by the legacy Google Sheet's `Nhập lịch` tab.
 * They deliberately stay in the same order in the CRM workbook so Mỹ Nhung
 * can move a schedule between the two systems without re-keying it.
 */
export const schoolScheduleGsheetHeaders = [
  "Mã dòng", "Ngày dạy", "Trường", "Khối", "Lớp", "Buổi", "Tiết",
  "Bắt đầu", "Kết thúc", "Môi trường", "Tình trạng", "Nguồn/Ghi chú",
  "Mã CRM (giữ khi sửa)",
] as const;

type WorkbookCell = string | number | boolean | Date | null | undefined;

function text(value: WorkbookCell) {
  return String(value ?? "").trim();
}

/** True when a worksheet is the unmodified export of the existing Google Sheet. */
export function isGsheetScheduleInputSheet(sheetName: string) {
  return sheetName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "nhap lich";
}

/**
 * `Nhập lịch` does not have a table header row. Its schedule starts at column
 * A and each valid record has a source row id, date, school and class. The
 * remaining columns (week, approval state, batch, etc.) are legacy workflow
 * metadata and are intentionally not interpreted as a new CRM instruction.
 */
export function extractGsheetScheduleRows(
  grid: WorkbookCell[][],
  options: { readDate: (value: WorkbookCell) => string; readTime: (value: WorkbookCell) => string },
) {
  const rows: SchoolNeedInput[] = [];
  grid.forEach((cells) => {
    const legacySourceRowId = text(cells[0]);
    const date = options.readDate(cells[1]);
    const school = text(cells[2]);
    const className = text(cells[4]);
    if (!legacySourceRowId || !date || !school || !className) return;
    rows.push({
      legacySourceRowId,
      date,
      school,
      grade: text(cells[3]),
      className,
      session: text(cells[5]),
      periodLabel: text(cells[6]),
      start: options.readTime(cells[7]),
      end: options.readTime(cells[8]),
      environment: text(cells[9]),
      sourceStatus: text(cells[10]) || "Dạy",
      sourceNote: text(cells[11]),
    });
  });
  return rows;
}
