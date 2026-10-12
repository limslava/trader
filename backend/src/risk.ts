import type { Candle } from './moex.js';

/**
 * Plain risk numbers for a single instrument over the last year: how much it moves with the index (beta),
 * the worst peak-to-trough fall, and the worst single day. All from daily closes; no model involved.
 */
export type RiskStats = {
  beta: number | null;
  maxDrawdownPct: number | null;
  worstDayPct: number | null;
  bestDayPct: number | null;
  days: number;
};

function returns(c: Candle[]): Map<string, number> {
  const out = new Map<string, number>();
  for (let i = 1; i < c.length; i++) out.set(c[i].time.slice(0, 10), c[i].close / c[i - 1].close - 1);
  return out;
}

export function riskStats(daily: Candle[], index: Candle[]): RiskStats {
  const year = daily.slice(-260);
  if (year.length < 40) return { beta: null, maxDrawdownPct: null, worstDayPct: null, bestDayPct: null, days: year.length };

  const r = returns(year);
  const ri = returns(index.slice(-260));
  const pairs = [...r].filter(([d]) => ri.has(d)).map(([d, x]) => [x, ri.get(d)!] as const);
  let beta: number | null = null;
  if (pairs.length >= 40) {
    const mx = pairs.reduce((a, [x]) => a + x, 0) / pairs.length;
    const my = pairs.reduce((a, [, y]) => a + y, 0) / pairs.length;
    const cov = pairs.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0);
    const varI = pairs.reduce((a, [, y]) => a + (y - my) ** 2, 0);
    beta = varI ? Number((cov / varI).toFixed(2)) : null;
  }

  let peak = year[0].close;
  let mdd = 0;
  for (const c of year) {
    peak = Math.max(peak, c.close);
    mdd = Math.min(mdd, c.close / peak - 1);
  }
  const vals = [...r.values()];
  return {
    beta,
    maxDrawdownPct: Number((mdd * 100).toFixed(1)),
    worstDayPct: Number((Math.min(...vals) * 100).toFixed(1)),
    bestDayPct: Number((Math.max(...vals) * 100).toFixed(1)),
    days: year.length,
  };
}
