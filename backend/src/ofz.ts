import { config } from './config.js';
import { TtlCache } from './http.js';

/**
 * Risk-free benchmark for a Russian investor: yields of fixed-coupon OFZ (26xxx series) at ~1, ~3 and ~5 years.
 * Floaters (29xxx), inflation-linked (52xxx) and CNY issues are skipped because their quoted yield is not comparable.
 */
export type OfzYields = { y1: OfzPoint | null; y3: OfzPoint | null; y5: OfzPoint | null };
export type OfzPoint = { secid: string; name: string; maturity: string; yieldPct: number };

const cache = new TtlCache<OfzYields>(30 * 60_000);

export function getOfzYields(): Promise<OfzYields> {
  return cache.get('ofz', async () => {
    const url = new URL(`${config.MOEX_ISS_URL}/engines/stock/markets/bonds/boards/TQOB/securities.json`);
    url.searchParams.set('iss.meta', 'off');
    url.searchParams.set('iss.only', 'securities,marketdata');
    url.searchParams.set('securities.columns', 'SECID,SHORTNAME,MATDATE');
    url.searchParams.set('marketdata.columns', 'SECID,YIELD');
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`MOEX bonds ${res.status}`);
    const d = (await res.json()) as { securities: { data: [string, string, string][] }; marketdata: { data: [string, number | null][] } };
    const yields = new Map(d.marketdata.data.map(([s, y]) => [s, y]));
    const now = Date.now();
    const points = d.securities.data
      .filter(([secid, name]) => name.startsWith('ОФЗ 26') && secid.startsWith('SU26'))
      .map(([secid, name, maturity]) => ({ secid, name, maturity, yieldPct: yields.get(secid) ?? 0, years: (Date.parse(maturity) - now) / (365.25 * 86_400_000) }))
      .filter((p) => p.yieldPct > 0 && p.years > 0.25);
    const nearest = (years: number) => {
      const best = points.reduce<(typeof points)[number] | null>((a, p) => (!a || Math.abs(p.years - years) < Math.abs(a.years - years) ? p : a), null);
      return best && Math.abs(best.years - years) <= years * 0.6 ? { secid: best.secid, name: best.name, maturity: best.maturity, yieldPct: best.yieldPct } : null;
    };
    return { y1: nearest(1), y3: nearest(3), y5: nearest(5) };
  });
}
