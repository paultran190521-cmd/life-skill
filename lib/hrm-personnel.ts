/**
 * HRM stores the collaboration start year as the final four digits of the
 * numeric part of its internal personnel code, for example 26122022/CTV-MS.
 */
export function cooperationYearsFromPersonnelCode(
  personnelCode: string | undefined,
  currentYear = new Date().getFullYear(),
): number | undefined {
  const digits = String(personnelCode || "").replace(/\D/g, "");
  if (digits.length < 4) return undefined;

  const startYear = Number(digits.slice(-4));
  if (!Number.isInteger(startYear) || startYear < 1900 || startYear > currentYear) return undefined;

  return currentYear - startYear;
}
