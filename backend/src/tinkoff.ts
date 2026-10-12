import fs from 'node:fs';
import path from 'node:path';
import tls from 'node:tls';
import { Agent } from 'undici';
import { config } from './config.js';
import { HttpError, todayMsk, TtlCache } from './http.js';

/**
 * T-Invest API (REST gateway). T-Bank's certificate chains to the Russian Trusted CA, which we trust for this
 * host only (a dedicated undici dispatcher) rather than process-wide, so it cannot vouch for any other site.
 * A Sandbox token only works against the sandbox host, which also serves instruments (dividends, fundamentals)
 * and quotes, so one token covers both analysis data and paper trading.
 */
const HOST = config.TINKOFF_SANDBOX === 'true' ? 'sandbox-invest-public-api.tbank.ru' : 'invest-public-api.tbank.ru';
const BASE = `https://${HOST}/rest/tinkoff.public.invest.api.contract.v1.`;

export const isSandbox = config.TINKOFF_SANDBOX === 'true';

const CA_FILE = path.resolve(import.meta.dirname, '../certs/russian-trusted-ca.pem');
const dispatcher = new Agent({
  connect: { ca: [...tls.rootCertificates, fs.readFileSync(CA_FILE, 'utf8')] },
});

type Quotation = { units?: string; nano?: number };
type Money = Quotation & { currency?: string };

/** T-Invest encodes decimals as {units, nano}; absent means zero or "no data". */
export const q = (v: Quotation | undefined): number | null =>
  v ? Number(v.units ?? 0) + (v.nano ?? 0) / 1e9 : null;

export function tinkoffConfigured(): boolean {
  return config.TINKOFF_TOKEN.length > 0;
}

// Broker errors a beginner can actually run into, in plain Russian.
const ERRORS_RU: [RegExp, string][] = [
  [/price is outside the limits/i, 'цена вне допустимого биржей диапазона на сегодня — укажите цену ближе к текущей'],
  [/not enough (balance|assets|money)/i, 'недостаточно средств на счёте'],
  [/instrument is not available for trading|trading is not available/i, 'по этой бумаге сейчас нет торгов'],
  [/order not found/i, 'заявка не найдена — возможно, уже исполнена или снята'],
  [/account not found/i, 'счёт не найден'],
  [/rate limit|too many requests/i, 'слишком много запросов, повторите через минуту'],
];

function translateError(message: string): string {
  return ERRORS_RU.find(([re]) => re.test(message))?.[1] ?? message;
}

export async function call<T>(method: string, body: unknown): Promise<T> {
  if (!tinkoffConfigured()) throw new HttpError(503, 'T-Invest не настроен: задайте TINKOFF_TOKEN в .env');
  const res = await fetch(BASE + method, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.TINKOFF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
    // @ts-expect-error undici's dispatcher option is not in the DOM fetch types
    dispatcher,
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; description?: string };
  if (!res.ok) {
    console.error(`T-Invest ${method} ${res.status}:`, data);
    const msg = res.status === 401 ? 'токен T-Invest недействителен или истёк' : translateError(data.message ?? `ошибка ${res.status}`);
    throw new HttpError(502, `T-Invest: ${msg}`);
  }
  return data as T;
}

type Instrument = { uid: string; figi: string; assetUid?: string; ticker: string; name: string };

const instrumentCache = new TtlCache<Instrument>(24 * 60 * 60_000);

export function getInstrument(secid: string): Promise<Instrument> {
  return instrumentCache.get(secid, async () => {
    const { instrument } = await call<{ instrument: Instrument }>('InstrumentsService/GetInstrumentBy', {
      idType: 'INSTRUMENT_ID_TYPE_TICKER',
      classCode: 'TQBR',
      id: secid,
    });
    return instrument;
  });
}

export type Dividend = {
  recordDate: string | null; // дата фиксации реестра
  lastBuyDate: string | null; // последний день покупки под дивиденд
  paymentDate: string | null;
  declaredDate: string | null;
  amount: number | null;
  currency: string | null;
  yieldPct: number | null;
  type: string | null;
  regularity: string | null;
};

type RawDividend = {
  dividendNet?: Money;
  paymentDate?: string;
  declaredDate?: string;
  lastBuyDate?: string;
  recordDate?: string;
  dividendType?: string;
  regularity?: string;
  yieldValue?: Quotation;
};

const day = (s?: string) => (s && !s.startsWith('1970') ? s.slice(0, 10) : null);
const dividendCache = new TtlCache<Dividend[]>(6 * 60 * 60_000);

/** Dividends from 3 years ago through announced future ones, newest first. */
export function getDividends(secid: string): Promise<Dividend[]> {
  return dividendCache.get(secid, async () => {
    const { uid } = await getInstrument(secid);
    const now = Date.now();
    const { dividends = [] } = await call<{ dividends?: RawDividend[] }>('InstrumentsService/GetDividends', {
      instrumentId: uid,
      from: new Date(now - 3 * 365 * 86_400_000).toISOString(),
      to: new Date(now + 365 * 86_400_000).toISOString(),
    });
    return dividends
      .map((d) => ({
        recordDate: day(d.recordDate),
        lastBuyDate: day(d.lastBuyDate),
        paymentDate: day(d.paymentDate),
        declaredDate: day(d.declaredDate),
        amount: q(d.dividendNet),
        currency: d.dividendNet?.currency ?? null,
        yieldPct: q(d.yieldValue),
        type: d.dividendType || null,
        regularity: d.regularity || null,
      }))
      .sort((a, b) => (b.recordDate ?? '').localeCompare(a.recordDate ?? ''));
  });
}

export type Fundamentals = Record<string, number | string | null>;

// Fields worth showing and sending to the AI, with Russian labels for the UI.
export const FUNDAMENTAL_FIELDS: Record<string, string> = {
  marketCapitalization: 'Капитализация',
  revenueTtm: 'Выручка (12 мес.)',
  ebitdaTtm: 'EBITDA (12 мес.)',
  netIncomeTtm: 'Чистая прибыль (12 мес.)',
  freeCashFlowTtm: 'Свободный денежный поток (12 мес.)',
  peRatioTtm: 'P/E',
  priceToBookTtm: 'P/B',
  priceToSalesTtm: 'P/S',
  evToEbitdaMrq: 'EV/EBITDA',
  netDebtToEbitda: 'Чистый долг / EBITDA',
  totalDebtToEquityMrq: 'Долг / капитал',
  roe: 'ROE, %',
  roa: 'ROA, %',
  netMarginMrq: 'Чистая маржа, %',
  dividendYieldDailyTtm: 'Дивидендная доходность, %',
  dividendPayoutRatioFy: 'Доля прибыли на дивиденды, %',
  fiveYearAnnualDividendGrowthRate: 'Рост дивидендов за 5 лет, % в год',
  revenueChangeFiveYears: 'Рост выручки за 5 лет, %',
  epsChangeFiveYears: 'Рост прибыли на акцию за 5 лет, %',
};

const fundamentalsCache = new TtlCache<Fundamentals | null>(6 * 60 * 60_000);

/** Latest fundamentals for the issuer, or null when T-Invest has none (e.g. funds). */
export function getFundamentals(secid: string): Promise<Fundamentals | null> {
  return fundamentalsCache.get(secid, async () => {
    const { assetUid } = await getInstrument(secid);
    if (!assetUid) return null;
    const { fundamentals = [] } = await call<{ fundamentals?: Record<string, unknown>[] }>(
      'InstrumentsService/GetAssetFundamentals',
      { assets: [assetUid] },
    );
    const f = fundamentals[0];
    if (!f) return null;
    const out: Fundamentals = { currency: typeof f.currency === 'string' ? f.currency : null };
    for (const key of Object.keys(FUNDAMENTAL_FIELDS)) {
      const v = f[key];
      out[key] = typeof v === 'number' && Number.isFinite(v) && v !== 0 ? v : null;
    }
    return out;
  });
}

export type AnalystTarget = { company: string; recommendation: 'BUY' | 'HOLD' | 'SELL'; target: number | null; date: string | null };
export type Forecast = {
  consensus: { recommendation: 'BUY' | 'HOLD' | 'SELL'; target: number | null; min: number | null; max: number | null; upsidePct: number | null };
  targets: AnalystTarget[];
  counts: { buy: number; hold: number; sell: number };
};
export type InsiderDeal = { date: string | null; direction: 'buy' | 'sell'; quantity: number; price: number | null; who: string; position: string };

const rec = (s?: string): 'BUY' | 'HOLD' | 'SELL' => (s?.endsWith('SELL') ? 'SELL' : s?.endsWith('HOLD') ? 'HOLD' : 'BUY');
const forecastCache = new TtlCache<Forecast | null>(6 * 60 * 60_000);
const insiderCache = new TtlCache<InsiderDeal[]>(6 * 60 * 60_000);

/** Brokerage-house targets and T-Invest's consensus; null when nobody covers the instrument. */
export function getForecast(secid: string): Promise<Forecast | null> {
  return forecastCache.get(secid, async () => {
    const { uid } = await getInstrument(secid);
    type RawTarget = { company?: string; recommendation?: string; targetPrice?: Quotation; recommendationDate?: string };
    type RawConsensus = { recommendation?: string; consensus?: Quotation; minTarget?: Quotation; maxTarget?: Quotation; priceChangeRel?: Quotation };
    const d = await call<{ targets?: RawTarget[]; consensus?: RawConsensus }>('InstrumentsService/GetForecastBy', { instrumentId: uid });
    if (!d.targets?.length || !d.consensus) return null;
    const targets = d.targets
      .map((t) => ({ company: t.company ?? '', recommendation: rec(t.recommendation), target: q(t.targetPrice), date: day(t.recommendationDate) }))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
    const counts = { buy: 0, hold: 0, sell: 0 };
    for (const t of targets) counts[t.recommendation.toLowerCase() as keyof typeof counts]++;
    return {
      consensus: {
        recommendation: rec(d.consensus.recommendation),
        target: q(d.consensus.consensus),
        min: q(d.consensus.minTarget),
        max: q(d.consensus.maxTarget),
        upsidePct: q(d.consensus.priceChangeRel),
      },
      targets,
      counts,
    };
  });
}

/** Insider trades disclosed by the issuer, newest first. */
export function getInsiderDeals(secid: string): Promise<InsiderDeal[]> {
  return insiderCache.get(secid, async () => {
    const { uid } = await getInstrument(secid);
    type Raw = { date?: string; direction?: string; quantity?: string; price?: Quotation; investorName?: string; investorPosition?: string };
    const { insiderDeals = [] } = await call<{ insiderDeals?: Raw[] }>('InstrumentsService/GetInsiderDeals', { instrumentId: uid, limit: 20 });
    return insiderDeals
      .map((x) => ({
        date: day(x.date),
        direction: (x.direction?.endsWith('SELL') ? 'sell' : 'buy') as 'buy' | 'sell',
        quantity: Number(x.quantity ?? 0),
        price: q(x.price),
        who: x.investorName ?? '',
        position: x.investorPosition ?? '',
      }))
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  });
}

export type CompanyData = {
  fundamentals: Fundamentals | null;
  dividends: { upcoming: Dividend[]; recent: Dividend[] };
  forecast: Forecast | null;
  insiders: InsiderDeal[];
};


/** Dividends and fundamentals together; null when T-Invest is not configured or unavailable. */
export async function getCompanyData(secid: string): Promise<CompanyData | null> {
  if (!tinkoffConfigured()) return null;
  try {
    // Each source fails independently; forecasts/insiders are extras and must not hide fundamentals.
    const [fundamentals, dividends, forecast, insiders] = await Promise.all([
      getFundamentals(secid),
      getDividends(secid),
      getForecast(secid).catch(() => null),
      getInsiderDeals(secid).catch(() => []),
    ]);
    const t = todayMsk();
    return {
      fundamentals,
      dividends: {
        upcoming: dividends.filter((d) => (d.recordDate ?? '') >= t).reverse(),
        recent: dividends.filter((d) => (d.recordDate ?? '') < t).slice(0, 4),
      },
      forecast,
      insiders,
    };
  } catch (err) {
    console.warn(`Company data for ${secid} unavailable:`, err instanceof Error ? err.message : err);
    return null;
  }
}

const bln = (v: number | string | null | undefined) => (typeof v === 'number' ? Math.round(v / 1e8) / 10 : null);

/** Compact form for prompts: key ratios, money in billions of rubles, dividends with dates. */
export function companyForPrompt(data: CompanyData | null) {
  if (!data) return null;
  const f = data.fundamentals;
  const div = (d: Dividend) => ({
    lastBuyDate: d.lastBuyDate,
    recordDate: d.recordDate,
    amountRub: d.amount,
    yieldPct: d.yieldPct && Number(d.yieldPct.toFixed(2)),
  });
  return {
    fundamentals: f && {
      marketCapBlnRub: bln(f.marketCapitalization),
      revenueTtmBlnRub: bln(f.revenueTtm),
      ebitdaTtmBlnRub: bln(f.ebitdaTtm),
      netIncomeTtmBlnRub: bln(f.netIncomeTtm),
      freeCashFlowTtmBlnRub: bln(f.freeCashFlowTtm),
      pe: f.peRatioTtm,
      pb: f.priceToBookTtm,
      ps: f.priceToSalesTtm,
      evToEbitda: f.evToEbitdaMrq,
      netDebtToEbitda: f.netDebtToEbitda,
      roePct: f.roe,
      netMarginPct: f.netMarginMrq,
      dividendYieldTtmPct: f.dividendYieldDailyTtm,
      payoutRatioPct: f.dividendPayoutRatioFy,
      revenueChange5yPct: f.revenueChangeFiveYears,
      epsChange5yPct: f.epsChangeFiveYears,
    },
    upcomingDividends: data.dividends.upcoming.map(div),
    recentDividends: data.dividends.recent.map(div),
    analystConsensus: data.forecast && {
      recommendation: data.forecast.consensus.recommendation,
      targetPriceRub: data.forecast.consensus.target,
      targetRangeRub: [data.forecast.consensus.min, data.forecast.consensus.max],
      upsidePct: data.forecast.consensus.upsidePct,
      houses: data.forecast.counts,
      latest: data.forecast.targets.slice(0, 5).map((t) => `${t.company}: ${t.recommendation} ${t.target ?? '?'} ₽ (${t.date})`),
    },
    // Only recent insider activity is informative; a 2020 trade is noise.
    insiderDealsLast12m: data.insiders
      .filter((d) => (d.date ?? '') >= new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10))
      .slice(0, 8)
      .map((d) => `${d.date}: ${d.direction === 'buy' ? 'покупка' : 'продажа'} ${d.quantity} шт. по ${d.price ?? '?'} ₽ — ${d.position}`),
  };
}

type LiveQuote = { price: number | null; prevPrice: number | null; changePct: number; updateTime: string | null };

const lastPriceCache = new TtlCache<Map<string, { price: number; time: string }>>(10_000);

/**
 * Replaces MOEX's delayed prices with T-Invest real-time last prices when a token is configured.
 * Change is recomputed against MOEX's previous close. Any failure leaves the MOEX data untouched.
 */
export async function withLivePrices<T extends LiveQuote & { secid: string }>(quotes: T[]): Promise<T[]> {
  if (!tinkoffConfigured() || quotes.length === 0) return quotes;
  try {
    const instruments = await Promise.all(quotes.map((qt) => getInstrument(qt.secid).catch(() => null)));
    const uids = instruments.flatMap((i) => (i ? [i.uid] : []));
    const prices = await lastPriceCache.get([...uids].sort().join(','), async () => {
      const { lastPrices = [] } = await call<{ lastPrices?: { instrumentUid: string; price?: Quotation; time?: string }[] }>(
        'MarketDataService/GetLastPrices',
        { instrumentId: uids },
      );
      return new Map(
        lastPrices.flatMap((p) => {
          const price = q(p.price);
          return price ? [[p.instrumentUid, { price, time: p.time ?? '' }] as const] : [];
        }),
      );
    });
    return quotes.map((qt, i) => {
      const live = instruments[i] && prices.get(instruments[i].uid);
      if (!live) return qt;
      const changePct = qt.prevPrice ? Number((((live.price - qt.prevPrice) / qt.prevPrice) * 100).toFixed(2)) : qt.changePct;
      // T-Invest times are UTC; show Moscow time like MOEX does.
      const msk = live.time ? new Date(Date.parse(live.time) + 3 * 3600_000).toISOString().slice(11, 19) : qt.updateTime;
      return { ...qt, price: live.price, changePct, updateTime: msk };
    });
  } catch (err) {
    console.warn('Live prices unavailable:', err instanceof Error ? err.message : err);
    return quotes;
  }
}
