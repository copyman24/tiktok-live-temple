// "Which part of the show makes viewers leave?" (from the classroom app, now for every session).
// Every 15 s, while connected to a live room, record (session, phase, viewer count). The report
// shows, per phase, how many minutes it ran and how many viewers it gained or lost per minute.
import { dayKey } from './time.js';

/**
 * @param {{
 *   collection: { set: (key: string, value: object) => void, withPrefix: (prefix: string) => [string, any][] },
 *   sample: () => { session: string, phase: string, viewers: number } | null,
 *   intervalMs?: number, now?: () => number
 * }} options
 */
export function createViewerSampler({ collection, sample, intervalMs = 15_000, now = Date.now }) {
  let seq = 0;
  function record() {
    const s = sample();
    if (!s || !s.phase || !(s.viewers > 0)) return;
    const at = now();
    collection.set(`${dayKey(new Date(at))}|${String(at).padStart(14, '0')}|${seq++ % 1000}`, { at, session: s.session, phase: s.phase, viewers: s.viewers });
  }
  const timer = setInterval(record, intervalMs);
  timer.unref?.();
  return {
    record,
    rows: (day) => collection.withPrefix(`${day}|`).map(([, row]) => row),
    stop: () => clearInterval(timer)
  };
}

/** Per (session, phase): minutes, average viewers, viewers gained (+) or lost (−) per minute. Worst first. */
export function viewStats(rows) {
  const by = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const key = `${r.session}\u0000${r.phase}`;
    const b = by.get(key) ?? { session: r.session, phase: r.phase, n: 0, sum: 0, delta: 0, ms: 0 };
    b.n++;
    b.sum += r.viewers;
    const next = rows[i + 1];
    // Only consecutive samples of the same session less than a minute apart (a restart is not a loss).
    if (next && next.session === r.session && next.at - r.at < 60_000) {
      b.delta += next.viewers - r.viewers;
      b.ms += next.at - r.at;
    }
    by.set(key, b);
  }
  return [...by.values()]
    .map((b) => ({ session: b.session, phase: b.phase, minutes: b.ms / 60_000, avg: b.sum / b.n, perMin: b.ms ? (b.delta / b.ms) * 60_000 : 0 }))
    .sort((a, b) => a.perMin - b.perMin);
}

/** An HTML table for a report page. `names` maps phase ids to labels; `sessions` maps session ids. */
export function viewStatsTable(stats, { names = {}, sessions = {} } = {}) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  if (!stats.length) return '<p class="muted">Chưa có số liệu (chưa kết nối TikTok trong ngày này).</p>';
  const multi = new Set(stats.map((s) => s.session)).size > 1;
  const rows = stats.map((r) => `<tr><td>${multi ? `${esc(sessions[r.session] ?? r.session)} · ` : ''}${esc(names[r.phase] ?? r.phase)}</td><td>${r.minutes.toFixed(0)} phút</td><td>${r.avg.toFixed(0)}</td><td class="${r.perMin < 0 ? 'down' : 'up'}">${r.perMin > 0 ? '+' : ''}${r.perMin.toFixed(1)}</td></tr>`).join('');
  return `<table class="views"><thead><tr><th>Phần</th><th>Thời gian</th><th>Xem TB</th><th>Thay đổi / phút</th></tr></thead><tbody>${rows}</tbody></table>`;
}
