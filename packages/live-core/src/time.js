// Calendar keys in Vietnam time (UTC+7), whatever timezone the machine is set to.
const VN_OFFSET_MS = 7 * 3_600_000;

/** "2026-11-06" in Vietnam time. */
export function dayKey(date = new Date()) {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** ISO week in Vietnam time, e.g. "2026-W45" (weeks start on Monday). */
export function weekKey(date = new Date()) {
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
