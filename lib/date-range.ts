export function parseDateRange(params: URLSearchParams): { from: string; to: string } | null {
  const from = params.get("from");
  const to = params.get("to");
  if (!from && !to) return null;
  const valid = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
  if (!valid(from) || !valid(to) || from > to || Date.parse(to) - Date.parse(from) > 62 * 86400000) throw new Error("Khoảng ngày phải hợp lệ và không vượt quá 63 ngày.");
  return { from, to };
}
