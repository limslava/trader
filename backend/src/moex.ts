import { config } from './config.js';
import { HttpError, TtlCache } from './http.js';

// Shares and ETFs (БПИФ) on MOEX all trade on the main T+ board.
const BOARD_PATH = '/engines/stock/markets/shares/boards/TQBR/securities';
const SEARCH_TYPES = new Set(['common_share', 'preferred_share', 'exchange_ppif', 'depositary_receipt']);

export type Candle = {
  time: string; // MSK, "YYYY-MM-DD HH:mm:ss"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  value: number;
};

export type Quote = {
  secid: string;
  shortname: string;
  name: string;
  lotSize: number;
  decimals: number;
  price: number | null;
  prevPrice: number | null;
  changePct: number;
  open: number | null;
  high: number | null;
  low: number | null;
  valueToday: number;
  updateTime: string | null;
};

export type SearchResult = { secid: string; shortname: string; name: string; type: string };

/** ISS candle intervals: 1/10/60 minutes, 24 = day, 7 = week, 31 = month. */
export const CANDLE_INTERVALS = [1, 10, 60, 24, 7, 31] as const;
export type CandleInterval = (typeof CANDLE_INTERVALS)[number];

type IssTable = { columns: string[]; data: unknown[][] };

function rows(table: IssTable | undefined): Record<string, unknown>[] {
  if (!table) return [];
  return table.data.map((row) => Object.fromEntries(table.columns.map((c, i) => [c, row[i]])));
}

async function iss(path: string, params: Record<string, string | number>): Promise<Record<string, IssTable>> {
  const url = new URL(config.MOEX_ISS_URL + path);
  url.searchParams.set('iss.meta', 'off');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new HttpError(502, `MOEX ISS вернул ${res.status}`);
  return (await res.json()) as Record<string, IssTable>;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const searchCache = new TtlCache<SearchResult[]>(60 * 60_000);
const quoteCache = new TtlCache<Quote[]>(15_000);
export function search(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return Promise.resolve([]);
  return searchCache.get(q.toLowerCase(), async () => {
    const data = await iss('/securities.json', {
      q,
      engine: 'stock',
      market: 'shares',
      is_trading: 1,
      limit: 50,
      'securities.columns': 'secid,shortname,name,type,primary_boardid',
    });
    return rows(data.securities)
      .filter((r) => r.primary_boardid === 'TQBR' && SEARCH_TYPES.has(String(r.type)))
      .slice(0, 15)
      .map((r) => ({
        secid: String(r.secid),
        shortname: String(r.shortname),
        name: String(r.name),
        type: String(r.type),
      }));
  });
}

export function getQuotes(secids: string[]): Promise<Quote[]> {
  if (secids.length === 0) return Promise.resolve([]);
  const key = [...secids].sort().join(',');
  return quoteCache.get(key, async () => {
    const data = await iss(`${BOARD_PATH}.json`, {
      securities: key,
      'iss.only': 'securities,marketdata',
      'securities.columns': 'SECID,SHORTNAME,SECNAME,PREVPRICE,LOTSIZE,DECIMALS',
      'marketdata.columns': 'SECID,LAST,OPEN,HIGH,LOW,LASTTOPREVPRICE,VALTODAY,UPDATETIME',
    });
    const market = new Map(rows(data.marketdata).map((r) => [r.SECID, r]));
    return rows(data.securities).map((s) => {
      const m = market.get(s.SECID) ?? {};
      const last = num(m.LAST);
      const prevPrice = num(s.PREVPRICE);
      return {
        secid: String(s.SECID),
        shortname: String(s.SHORTNAME),
        name: String(s.SECNAME),
        lotSize: num(s.LOTSIZE) ?? 1,
        decimals: num(s.DECIMALS) ?? 2,
        price: last ?? prevPrice,
        prevPrice,
        changePct: last !== null ? (num(m.LASTTOPREVPRICE) ?? 0) : 0,
        open: num(m.OPEN),
        high: num(m.HIGH),
        low: num(m.LOW),
        valueToday: num(m.VALTODAY) ?? 0,
        updateTime: typeof m.UPDATETIME === 'string' ? m.UPDATETIME : null,
      };
    });
  });
}

export async function getQuote(secid: string): Promise<Quote> {
  const [quote] = await getQuotes([secid]);
  if (!quote) throw new HttpError(404, `Инструмент ${secid} не найден на TQBR`);
  return quote;
}

// Daily+ candles change slowly; intraday ones need fresher data.
const candleCache = new TtlCache<Candle[]>(60_000);
const dailyCandleCache = new TtlCache<Candle[]>(10 * 60_000);

/** Fetches candles from `from` (YYYY-MM-DD) to now, following ISS pagination (500 rows per page). */
function fetchCandles(basePath: string, secid: string, interval: CandleInterval, from: string): Promise<Candle[]> {
  const cache = interval === 24 || interval === 7 || interval === 31 ? dailyCandleCache : candleCache;
  return cache.get(`${basePath}:${secid}:${interval}:${from}`, async () => {
    const out: Candle[] = [];
    for (let start = 0; start < 10_000; ) {
      const data = await iss(`${basePath}/${encodeURIComponent(secid)}/candles.json`, { interval, from, start });
      const page = rows(data.candles);
      for (const r of page) {
        out.push({
          time: String(r.begin),
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: Number(r.volume),
          value: Number(r.value),
        });
      }
      if (page.length < 500) break;
      start += page.length;
    }
    return out;
  });
}

export const INDEX_SECID = 'IMOEX';

export function getCandles(secid: string, interval: CandleInterval, from: string): Promise<Candle[]> {
  return secid === INDEX_SECID
    ? fetchCandles('/engines/stock/markets/index/securities', secid, interval, from)
    : fetchCandles(BOARD_PATH, secid, interval, from);
}

export type IndexMember = { secid: string; shortname: string; weight: number };

const compositionCache = new TtlCache<IndexMember[]>(6 * 60 * 60_000);

/** Current IMOEX constituents with weights (percent). */
export function getIndexComposition(): Promise<IndexMember[]> {
  return compositionCache.get(INDEX_SECID, async () => {
    const out: IndexMember[] = [];
    for (let start = 0; start < 500; ) {
      const data = await iss(`/statistics/engines/stock/markets/index/analytics/${INDEX_SECID}.json`, { start, limit: 100 });
      const page = rows(data.analytics);
      for (const r of page) out.push({ secid: String(r.secids), shortname: String(r.shortnames), weight: Number(r.weight) });
      if (page.length < 100) break;
      start += page.length;
    }
    return out.sort((a, b) => b.weight - a.weight);
  });
}

export function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}
