import { pool } from './db.js';
import { daysAgo, getCandles, type Candle } from './moex.js';

/**
 * Settles past AI verdicts against what the price actually did. BUY is a hit if the price rose over the
 * horizon, SELL if it fell; HOLD is scored separately (a hit if the move stayed within ±5%).
 * Nothing is stored: outcomes are recomputed from daily candles, so the record cannot be edited after the fact.
 */

export type Horizon = 7 | 30;
const HORIZONS: Horizon[] = [7, 30];
const HOLD_BAND_PCT = 5;

type Row = { id: number; secid: string; shortname: string; created_at: Date; price: string; signal: 'BUY' | 'SELL' | 'HOLD'; confidence: string };

export type Outcome = {
  id: number;
  secid: string;
  shortname: string;
  createdAt: Date;
  signal: Row['signal'];
  confidence: number;
  price: number;
  /** Return in % at each horizon; null while the horizon has not passed yet. */
  returns: Record<Horizon, number | null>;
  hits: Record<Horizon, boolean | null>;
  /** Return to the latest close, whatever the age. */
  returnNow: number | null;
};

const msk = (d: Date) => new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10);

/** First close on or after `date` (YYYY-MM-DD) among daily candles; null if the date is in the future. */
function closeOnOrAfter(daily: Candle[], date: string): number | null {
  const c = daily.find((x) => x.time.slice(0, 10) >= date);
  return c ? c.close : null;
}

function hit(signal: Row['signal'], ret: number | null): boolean | null {
  if (ret === null) return null;
  if (signal === 'BUY') return ret > 0;
  if (signal === 'SELL') return ret < 0;
  return Math.abs(ret) < HOLD_BAND_PCT;
}

async function dailyFor(secids: string[]): Promise<Map<string, Candle[]>> {
  const out = new Map<string, Candle[]>();
  for (let i = 0; i < secids.length; i += 5) {
    await Promise.all(
      secids.slice(i, i + 5).map(async (s) => out.set(s, await getCandles(s, 24, daysAgo(400)).catch(() => []))),
    );
  }
  return out;
}

function settle(rows: Row[], daily: Map<string, Candle[]>): Outcome[] {
  const today = msk(new Date());
  return rows.map((r) => {
    const series = daily.get(r.secid) ?? [];
    const price = Number(r.price);
    const start = msk(r.created_at);
    const latest = series[series.length - 1];
    const returns = {} as Record<Horizon, number | null>;
    const hits = {} as Record<Horizon, boolean | null>;
    for (const h of HORIZONS) {
      const target = new Date(Date.parse(start) + h * 86_400_000).toISOString().slice(0, 10);
      const close = target <= today ? closeOnOrAfter(series, target) : null;
      returns[h] = close && price ? Number((((close - price) / price) * 100).toFixed(2)) : null;
      hits[h] = hit(r.signal, returns[h]);
    }
    return {
      id: r.id,
      secid: r.secid,
      shortname: r.shortname,
      createdAt: r.created_at,
      signal: r.signal,
      confidence: Number(r.confidence),
      price,
      returns,
      hits,
      returnNow: latest && price ? Number((((latest.close - price) / price) * 100).toFixed(2)) : null,
    };
  });
}

export type Scorecard = {
  total: number;
  bySignal: Record<Row['signal'], Record<Horizon, { settled: number; hits: number; meanReturnPct: number | null }>>;
  outcomes: Outcome[];
};

/** Hit rates and mean returns for every verdict ever made, newest first. */
export async function buildScorecard(): Promise<Scorecard> {
  const { rows } = await pool.query<Row>(
    'SELECT id, secid, shortname, created_at, price, signal, confidence FROM analyses ORDER BY created_at DESC LIMIT 500',
  );
  const outcomes = settle(rows, await dailyFor([...new Set(rows.map((r) => r.secid))]));
  const bySignal = {} as Scorecard['bySignal'];
  for (const s of ['BUY', 'SELL', 'HOLD'] as const) {
    bySignal[s] = {} as Scorecard['bySignal'][typeof s];
    for (const h of HORIZONS) {
      const settled = outcomes.filter((o) => o.signal === s && o.returns[h] !== null);
      const mean = settled.length ? settled.reduce((a, o) => a + (o.returns[h] ?? 0), 0) / settled.length : null;
      bySignal[s][h] = {
        settled: settled.length,
        hits: settled.filter((o) => o.hits[h]).length,
        meanReturnPct: mean === null ? null : Number(mean.toFixed(2)),
      };
    }
  }
  return { total: rows.length, bySignal, outcomes };
}

/** Compact record of earlier verdicts on one instrument for the prompt (only ones old enough to judge). */
export async function pastCallsFor(secid: string, daily: Candle[]) {
  const { rows } = await pool.query<Row>(
    `SELECT id, secid, shortname, created_at, price, signal, confidence FROM analyses
     WHERE secid = $1 AND created_at < now() - interval '3 days' ORDER BY created_at DESC LIMIT 5`,
    [secid],
  );
  if (rows.length === 0) return null;
  return settle(rows, new Map([[secid, daily]])).map((o) => ({
    date: msk(o.createdAt),
    verdict: o.signal,
    confidence: o.confidence,
    priceThen: o.price,
    returnSincePct: o.returnNow,
    return7dPct: o.returns[7],
    return30dPct: o.returns[30],
  }));
}
