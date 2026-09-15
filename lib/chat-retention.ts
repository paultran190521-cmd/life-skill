/** Five calendar months, clamped to the final day of the target month. */
export function chatImageExpiresAt(createdAt: string): number | null {
  const date = new Date(createdAt);
  if (!createdAt || !Number.isFinite(date.getTime())) return null;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 5);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

export function isExpiredChatImage(row: { kind?: string; createdAt?: string; expiredAt?: string }, now = Date.now()): boolean {
  if (row.kind !== "image") return false;
  if (row.expiredAt) return true;
  const expiry = chatImageExpiresAt(row.createdAt || "");
  return expiry !== null && expiry <= now;
}
