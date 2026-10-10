import { TtlCache } from './http.js';
import { computeIndicators, type IndicatorSnapshot } from './indicators.js';
import { daysAgo, getCandles, getIndexComposition, INDEX_SECID } from './moex.js';

export type MarketContext = {
  imoex: {
    value: number | null;
    date: string | null;
    change1wPct: number | null;
    change1mPct: number | null;
    change3mPct: number | null;
    change1yPct: number | null;
    sma200: number | null;
    rsi14: number | null;
  } | null;
  keyRate: { pct: number; date: string } | null;
  usdRub: { rate: number; date: string } | null;
};

const CBR = 'https://www.cbr.ru';
const cache = new TtlCache<MarketContext>(30 * 60_000);

async function cbrText(path: string, encoding = 'utf-8'): Promise<string> {
  const res = await fetch(CBR + path, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`CBR ${path}: ${res.status}`);
  return new TextDecoder(encoding).decode(await res.arrayBuffer());
}

/** The CBR has no JSON API for the key rate; the first row of the history table is the current value. */
async function getKeyRate(): Promise<MarketContext['keyRate']> {
  const html = await cbrText('/hd_base/KeyRate/');
  const m = html.match(/<td>(\d{2}\.\d{2}\.\d{4})<\/td>\s*<td>([\d,]+)<\/td>/);
  if (!m) return null;
  const [d, mo, y] = m[1].split('.');
  return { pct: Number(m[2].replace(',', '.')), date: `${y}-${mo}-${d}` };
}

async function getUsdRub(): Promise<MarketContext['usdRub']> {
  const xml = await cbrText('/scripts/XML_daily.asp', 'windows-1251');
  const date = xml.match(/ValCurs Date="(\d{2})\.(\d{2})\.(\d{4})"/);
  const usd = xml.match(/<Valute ID="R01235">[\s\S]*?<Value>([\d,]+)<\/Value>/);
  if (!date || !usd) return null;
  return { rate: Number(usd[1].replace(',', '.')), date: `${date[3]}-${date[2]}-${date[1]}` };
}

export async function getImoexIndicators(): Promise<IndicatorSnapshot> {
  return computeIndicators(await getCandles(INDEX_SECID, 24, daysAgo(400)));
}

/** Each source fails independently: a CBR outage must not break analysis. */
export function getMarketContext(): Promise<MarketContext> {
  return cache.get('ctx', async () => {
    const [imoex, keyRate, usdRub] = await Promise.allSettled([getImoexIndicators(), getKeyRate(), getUsdRub()]);
    for (const r of [imoex, keyRate, usdRub]) if (r.status === 'rejected') console.warn('Market context:', r.reason);
    const ind = imoex.status === 'fulfilled' ? imoex.value : null;
    return {
      imoex: ind && {
        value: ind.close,
        date: ind.date,
        change1wPct: ind.change1wPct,
        change1mPct: ind.change1mPct,
        change3mPct: ind.change3mPct,
        change1yPct: ind.change1yPct,
        sma200: ind.sma200,
        rsi14: ind.rsi14,
      },
      keyRate: keyRate.status === 'fulfilled' ? keyRate.value : null,
      usdRub: usdRub.status === 'fulfilled' ? usdRub.value : null,
    };
  });
}

const diff = (a: number | null, b: number | null | undefined) =>
  a === null || b == null ? null : Number((a - b).toFixed(2));

/** How the instrument did relative to the index, plus its place in the index if it is a member. */
export async function relativeToIndex(secid: string, ind: IndicatorSnapshot, ctx: MarketContext) {
  const members = await getIndexComposition().catch(() => []);
  const member = members.find((m) => m.secid === secid);
  return {
    inImoex: Boolean(member),
    imoexWeightPct: member?.weight ?? null,
    vsImoex1mPct: diff(ind.change1mPct, ctx.imoex?.change1mPct),
    vsImoex3mPct: diff(ind.change3mPct, ctx.imoex?.change3mPct),
    vsImoex1yPct: diff(ind.change1yPct, ctx.imoex?.change1yPct),
  };
}
