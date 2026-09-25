/** Sheets append is not transactional. Collapse simultaneous retries by durable business key. */
export function uniqueWorkLogRows<T extends { id?: string; idempotencyKey?: string; status?: string; updatedAt?: string }>(rows: T[]): T[] {
  const rank: Record<string, number> = { CANCELLED: 6, CONFIRMED: 5, PENDING: 4, FAILED: 3, COMPLETED: 2 };
  const unique = new Map<string, T>();
  for (const row of rows) {
    const key = row.idempotencyKey || row.id;
    if (!key) continue;
    const prior = unique.get(key);
    if (!prior || (rank[row.status || ""] || 0) > (rank[prior.status || ""] || 0) || (row.status === prior.status && String(row.updatedAt || "") > String(prior.updatedAt || ""))) unique.set(key, row);
  }
  return [...unique.values()];
}
