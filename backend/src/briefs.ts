import { aiConfigured } from './ai.js';
import { pool } from './db.js';
import { createAnalysis } from './routes/analysis.js';
import { startReview } from './routes/review.js';
import { portfolio } from './trading.js';
import { tinkoffConfigured } from './tinkoff.js';

/**
 * Morning brief: on weekdays, before the market opens, refresh the AI reviews (index, watchlist, portfolio) and
 * the per-instrument verdicts for everything the user watches or holds. Without this the History page only
 * changes when someone presses a button, and verdicts go stale within days.
 */

export const BRIEF_HOUR_MSK = 9;
export const BRIEF_MINUTE_MSK = 30;
const MAX_INSTRUMENTS = 12;

async function instrumentsToAnalyze(): Promise<string[]> {
  const { rows } = await pool.query<{ secid: string }>('SELECT secid FROM watchlist ORDER BY added_at');
  const set = new Set(rows.map((r) => r.secid));
  if (tinkoffConfigured()) {
    const pf = await portfolio().catch(() => null);
    for (const p of pf?.positions ?? []) set.add(p.secid);
  }
  return [...set].slice(0, MAX_INSTRUMENTS);
}

/** Runs the whole brief sequentially (AI budget is 12 calls/min); failures are per item. */
export async function runMorningBrief(): Promise<{ reviews: string[]; analyses: string[]; errors: string[] }> {
  const out = { reviews: [] as string[], analyses: [] as string[], errors: [] as string[] };
  if (!aiConfigured()) return out;
  for (const scope of ['imoex', 'watchlist', 'portfolio'] as const) {
    try {
      const { done } = await startReview(scope);
      await done;
      out.reviews.push(scope);
    } catch (err) {
      out.errors.push(`review ${scope}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const secid of await instrumentsToAnalyze().catch(() => [] as string[])) {
    try {
      await createAnalysis(secid);
      out.analyses.push(secid);
    } catch (err) {
      out.errors.push(`${secid}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`Morning brief: reviews ${out.reviews.join(', ') || '—'}; analyses ${out.analyses.join(', ') || '—'}${out.errors.length ? `; errors: ${out.errors.join(' | ')}` : ''}`);
  return out;
}

let briefRunning = false;
export const briefInFlight = () => briefRunning;

export async function runMorningBriefOnce() {
  if (briefRunning) return;
  briefRunning = true;
  try {
    await runMorningBrief();
  } finally {
    briefRunning = false;
  }
}

/** Weekdays at 09:30 MSK; checked every minute. A restart after the slot (same morning) catches up. */
export function scheduleMorningBrief(): void {
  let lastDay = '';
  const tick = async () => {
    const msk = new Date(Date.now() + 3 * 3600_000);
    const day = msk.toISOString().slice(0, 10);
    const weekday = msk.getUTCDay() >= 1 && msk.getUTCDay() <= 5;
    const minutes = msk.getUTCHours() * 60 + msk.getUTCMinutes();
    const slot = BRIEF_HOUR_MSK * 60 + BRIEF_MINUTE_MSK;
    if (!weekday || lastDay === day || minutes < slot || minutes > slot + 90) return;
    // Already done today by a previous process? Then only mark the day.
    const { rows } = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM reviews WHERE scope = 'imoex' AND created_at > now() - interval '12 hours' AND status = 'done'`);
    lastDay = day;
    if (Number(rows[0]?.n ?? 0) > 0) return;
    await runMorningBriefOnce();
  };
  tick().catch((err) => console.error('Morning brief:', err));
  setInterval(() => tick().catch((err) => console.error('Morning brief:', err)), 60_000).unref();
}
