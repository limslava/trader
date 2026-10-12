import { TtlCache } from './http.js';
import { getOfzYields, type OfzYields } from './ofz.js';
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
  /** Risk-free alternative: fixed-coupon OFZ yields by horizon. */
  ofz: OfzYields | null;
  /** Deterministic read of the index: trend phase and volatility level, with the reasons. */
  regime: Regime | null;
};

export type Regime = { trend: 'uptrend' | 'recovery' | 'correction' | 'downtrend' | 'sideways'; volatility: 'low' | 'normal' | 'high'; label: string; reasons: string[] };

export function regimeOf(ind: IndicatorSnapshot): Regime {
  const c = ind.close ?? 0;
  const above200 = ind.sma200 != null && c > ind.sma200;
  const above50 = ind.sma50 != null && c > ind.sma50;
  const m1 = ind.change1mPct ?? 0;
  const m3 = ind.change3mPct ?? 0;
  const reasons: string[] = [];
  let trend: Regime['trend'];
  if (above200 && above50 && m3 > 0) {
    trend = 'uptrend';
    reasons.push('индекс выше 50- и 200-дневных средних, за 3 месяца растёт');
  } else if (!above200 && above50 && m1 > 0) {
    trend = 'recovery';
    reasons.push('индекс отскочил выше 50-дневной, но всё ещё ниже 200-дневной средней');
  } else if (above200 && !above50) {
    trend = 'correction';
    reasons.push('индекс ниже 50-дневной средней при долгосрочном росте');
  } else if (!above200 && !above50 && m3 < 0) {
    trend = 'downtrend';
    reasons.push('индекс ниже обеих средних и падает 3 месяца');
  } else {
    trend = 'sideways';
    reasons.push('нет выраженного направления');
  }
  const vol = ind.volatility20dPct ?? 0;
  const volatility: Regime['volatility'] = vol >= 30 ? 'high' : vol <= 15 ? 'low' : 'normal';
  reasons.push(`волатильность ${vol.toFixed(0)}% годовых — ${volatility === 'high' ? 'высокая, резкие движения' : volatility === 'low' ? 'низкая, спокойный рынок' : 'обычная'}`);
  const names: Record<Regime['trend'], string> = {
    uptrend: 'Рост',
    recovery: 'Восстановление',
    correction: 'Коррекция',
    downtrend: 'Падение',
    sideways: 'Боковик',
  };
  return { trend, volatility, label: `${names[trend]}${volatility === 'high' ? ', нервный рынок' : volatility === 'low' ? ', спокойный рынок' : ''}`, reasons };
}

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
    const [imoex, keyRate, usdRub, ofz] = await Promise.allSettled([getImoexIndicators(), getKeyRate(), getUsdRub(), getOfzYields()]);
    for (const r of [imoex, keyRate, usdRub, ofz]) if (r.status === 'rejected') console.warn('Market context:', r.reason);
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
      ofz: ofz.status === 'fulfilled' ? ofz.value : null,
      regime: ind ? regimeOf(ind) : null,
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
