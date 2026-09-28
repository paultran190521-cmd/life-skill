/**
 * HRM personnel codes begin with the collaboration date. Newer codes may add
 * a sequence suffix (for example 06072023-05/CTVMT), so the year must be read
 * from the date portion rather than from the final digits of the whole code.
 */
export function cooperationYearsFromPersonnelCode(
  personnelCode: string | undefined,
  currentYear = new Date().getFullYear(),
): number | undefined {
  const code = String(personnelCode || "").trim();
  if (!code) return undefined;

  // Prefer an explicit four-digit year wherever it appears in the date part:
  // 26122022/CTV-MS, 06072023-05/CTVMT, 19112025/CTVMT.
  const explicitYears = [...code.matchAll(/(?:19|20)\d{2}/g)]
    .map((match) => Number(match[0]))
    .filter((year) => year >= 1900 && year <= currentYear);
  const startYear = explicitYears.at(-1) ?? compactDateYear(code, currentYear);

  if (startYear === undefined) return undefined;

  return currentYear - startYear;
}

/** Handles HRM's compact DDMMYY-serial form, for example 010920-01/CTVMT. */
function compactDateYear(code: string, currentYear: number): number | undefined {
  const match = code.match(/^\d{4}(\d{2})(?=[\s/-]|$)/);
  if (!match) return undefined;

  const shortYear = Number(match[1]);
  const currentShortYear = currentYear % 100;
  const year = shortYear <= currentShortYear ? 2000 + shortYear : 1900 + shortYear;
  return year <= currentYear ? year : undefined;
}
