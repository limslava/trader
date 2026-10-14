import { Router } from 'express';
import { getMarketContext, relativeToIndex } from '../context.js';
import { HttpError, TtlCache } from '../http.js';
import { computeIndicators } from '../indicators.js';
import { daysAgo, getCandles, getIndexComposition, getQuotes, INDEX_SECID, type Candle } from '../moex.js';
import { computeScore, quantScore, type Score } from '../scoring.js';
import { getCompanyData, getSectors, type Fundamentals } from '../tinkoff.js';
import { secidSchema } from './market.js';

export const screenerRouter = Router();

export type ScreenerRow = {
  secid: string;
  shortname: string;
  weight: number;
  price: number | null;
  changePct: number;
  sector: string;
  score: Score;
  /** A few ratios for peer tables; null for funds. */
  ratios: { pe: number | null; dividendYieldPct: number | null; roePct: number | null; change3mPct: number | null };
  /** Compact technical read, reused by the Arena data package. */
  tech: { rsi14: number | null; change1wPct: number | null; change1mPct: number | null; change1yPct: number | null; aboveSma50: boolean | null; aboveSma200: boolean | null; volatility20dPct: number | null; fromHigh52wPct: number | null };
  lot: number;
};

const screenerCache = new TtlCache<ScreenerRow[]>(15 * 60_000);

/** Scores every IMOEX member; fundamentals come from T-Invest (cached 6 h there). */
export function screener(): Promise<ScreenerRow[]> {
  return screenerCache.get('imoex', async () => {
    const [members, market, sectors] = await Promise.all([getIndexComposition(), getMarketContext(), getSectors().catch(() => new Map<string, string>())]);
    const quotes = new Map((await getQuotes(members.map((m) => m.secid))).map((q) => [q.secid, q]));
    const rows: ScreenerRow[] = [];
    for (let i = 0; i < members.length; i += 5) {
      await Promise.all(
        members.slice(i, i + 5).map(async (m) => {
          const daily = await getCandles(m.secid, 24, daysAgo(400)).catch(() => []);
          if (daily.length < 60) return;
          const ind = computeIndicators(daily);
          const [rel, company] = await Promise.all([relativeToIndex(m.secid, ind, market), getCompanyData(m.secid)]);
          const q = quotes.get(m.secid);
          const f: Fundamentals | null = company?.fundamentals ?? null;
          const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
          rows.push({
            secid: m.secid,
            shortname: m.shortname,
            weight: m.weight,
            price: q?.price ?? null,
            changePct: q?.changePct ?? 0,
            sector: sectors.get(m.secid) ?? 'other',
            score: computeScore(ind, rel, f),
            ratios: { pe: num(f?.peRatioTtm), dividendYieldPct: num(f?.dividendYieldDailyTtm), roePct: num(f?.roe), change3mPct: ind.change3mPct },
            tech: {
              rsi14: ind.rsi14,
              change1wPct: ind.change1wPct,
              change1mPct: ind.change1mPct,
              change1yPct: ind.change1yPct,
              aboveSma50: ind.close !== null && ind.sma50 !== null ? ind.close > ind.sma50 : null,
              aboveSma200: ind.close !== null && ind.sma200 !== null ? ind.close > ind.sma200 : null,
              volatility20dPct: ind.volatility20dPct,
              fromHigh52wPct: ind.close !== null && ind.high52w ? Number((((ind.close - ind.high52w) / ind.high52w) * 100).toFixed(1)) : null,
            },
            lot: q?.lotSize ?? 1,
          });
        }),
      );
    }
    return rows.sort((a, b) => b.score.total - a.score.total);
  });
}

export async function scoreFor(secid: string): Promise<Score> {
  const [daily, market] = await Promise.all([getCandles(secid, 24, daysAgo(400)), getMarketContext()]);
  if (daily.length < 60) throw new HttpError(422, 'Слишком мало истории для скоринга');
  const ind = computeIndicators(daily);
  const [rel, company] = await Promise.all([relativeToIndex(secid, ind, market), getCompanyData(secid)]);
  return computeScore(ind, rel, company?.fundamentals ?? null);
}

// ---------------------------------------------------------------------------------------------------------
// Walk-forward check of the technical+relative score: does a high score today predict a higher return in
// 20 trading days than a low score? Only data up to each date is used, so there is no look-ahead.

export type Backtest = {
  horizonDays: number;
  dates: number;
  observations: number;
  strong: { n: number; hitRatePct: number | null; meanReturnPct: number | null };
  weak: { n: number; hitRatePct: number | null; meanReturnPct: number | null };
  neutral: { n: number; meanReturnPct: number | null };
  /** Mean forward return of the top fifth minus the bottom fifth of scores at each date: the "edge". */
  spreadPct: number | null;
  /** How often the top fifth beat the bottom fifth across dates. */
  spreadWinRatePct: number | null;
};

const backtestCache = new TtlCache<Backtest>(6 * 60 * 60_000);
export const HORIZONS = [10, 20, 60] as const;
const STEP = 5;
const MIN_HISTORY = 230; // enough bars for the 200-day average plus some

const pctChange = (from: number, to: number) => ((to - from) / from) * 100;

function relAt(slice: Candle[], index: Candle[]) {
  // The same calendar-day windows computeIndicators uses, applied to the index aligned by date.
  const ind = computeIndicators(slice);
  const idx = computeIndicators(index);
  const d = (a: number | null, b: number | null) => (a == null || b == null ? null : a - b);
  return { ind, rel: { vsImoex1mPct: d(ind.change1mPct, idx.change1mPct), vsImoex3mPct: d(ind.change3mPct, idx.change3mPct), vsImoex1yPct: d(ind.change1yPct, idx.change1yPct) } };
}

export function backtest(HORIZON: (typeof HORIZONS)[number] = 20): Promise<Backtest> {
  return backtestCache.get(`imoex:${HORIZON}`, async () => {
    const members = await getIndexComposition();
    const from = daysAgo(720);
    const index = await getCandles(INDEX_SECID, 24, from);
    const series = new Map<string, Candle[]>();
    for (let i = 0; i < members.length; i += 5) {
      await Promise.all(members.slice(i, i + 5).map(async (m) => series.set(m.secid, await getCandles(m.secid, 24, from).catch(() => []))));
    }

    type Obs = { score: number; fwd: number };
    const all: Obs[] = [];
    const spreads: number[] = [];
    let dates = 0;
    const idxDates = index.map((c) => c.time.slice(0, 10));

    for (let t = MIN_HISTORY; t + HORIZON < index.length; t += STEP) {
      const cutoff = idxDates[t];
      const obs: Obs[] = [];
      for (const [, daily] of series) {
        const upto = daily.filter((c) => c.time.slice(0, 10) <= cutoff);
        if (upto.length < MIN_HISTORY) continue;
        const after = daily[upto.length - 1 + HORIZON];
        if (!after) continue;
        const { ind, rel } = relAt(upto, index.slice(0, t + 1));
        obs.push({ score: quantScore(ind, rel), fwd: pctChange(upto[upto.length - 1].close, after.close) });
      }
      if (obs.length < 10) continue;
      dates++;
      all.push(...obs);
      const sorted = [...obs].sort((a, b) => b.score - a.score);
      const k = Math.max(1, Math.floor(sorted.length / 5));
      const mean = (xs: Obs[]) => xs.reduce((a, o) => a + o.fwd, 0) / xs.length;
      spreads.push(mean(sorted.slice(0, k)) - mean(sorted.slice(-k)));
    }

    const bucket = (filter: (o: Obs) => boolean, hit?: (o: Obs) => boolean) => {
      const xs = all.filter(filter);
      return {
        n: xs.length,
        hitRatePct: hit && xs.length ? Number(((xs.filter(hit).length / xs.length) * 100).toFixed(1)) : null,
        meanReturnPct: xs.length ? Number((xs.reduce((a, o) => a + o.fwd, 0) / xs.length).toFixed(2)) : null,
      };
    };
    return {
      horizonDays: HORIZON,
      dates,
      observations: all.length,
      strong: bucket((o) => o.score >= 65, (o) => o.fwd > 0),
      weak: bucket((o) => o.score <= 40, (o) => o.fwd < 0),
      neutral: { n: all.filter((o) => o.score > 40 && o.score < 65).length, meanReturnPct: bucket((o) => o.score > 40 && o.score < 65).meanReturnPct },
      spreadPct: spreads.length ? Number((spreads.reduce((a, b) => a + b, 0) / spreads.length).toFixed(2)) : null,
      spreadWinRatePct: spreads.length ? Number(((spreads.filter((s) => s > 0).length / spreads.length) * 100).toFixed(1)) : null,
    };
  });
}

screenerRouter.get('/', async (_req, res) => res.json(await screener()));

/** Sector weights of the index and the members in each sector. */
screenerRouter.get('/sectors', async (_req, res) => {
  const rows = await screener();
  const bySector = new Map<string, { weightPct: number; members: string[] }>();
  for (const r of rows) {
    const s = bySector.get(r.sector) ?? { weightPct: 0, members: [] };
    s.weightPct += r.weight;
    s.members.push(r.secid);
    bySector.set(r.sector, s);
  }
  res.json([...bySector].map(([sector, v]) => ({ sector, weightPct: Number(v.weightPct.toFixed(2)), members: v.members })).sort((a, b) => b.weightPct - a.weightPct));
});

/** The instrument and its sector peers from the index, ranked by score. */
screenerRouter.get('/peers/:secid', async (req, res) => {
  const secid = secidSchema.parse(req.params.secid);
  const rows = await screener();
  const me = rows.find((r) => r.secid === secid);
  if (!me) return void res.json({ sector: null, peers: [] });
  res.json({ sector: me.sector, peers: rows.filter((r) => r.sector === me.sector) });
});
screenerRouter.get('/backtest', async (req, res) => {
  const h = Number(req.query.horizon);
  res.json(await backtest((HORIZONS as readonly number[]).includes(h) ? (h as 10 | 20 | 60) : 20));
});
screenerRouter.get('/:secid', async (req, res) => res.json(await scoreFor(secidSchema.parse(req.params.secid))));
