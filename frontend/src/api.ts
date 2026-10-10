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

export type Candle = { time: string; open: number; high: number; low: number; close: number; volume: number; value: number };

export type Signal = 'BUY' | 'SELL' | 'HOLD';

export type WatchItem = {
  secid: string;
  shortname: string;
  quote: Quote | null;
  lastAnalysis: { signal: Signal; confidence: number; createdAt: string } | null;
};

export type Indicators = {
  date: string | null;
  close: number | null;
  bars: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: { line: number; signal: number; histogram: number } | null;
  bollinger: { upper: number; middle: number; lower: number } | null;
  atr14: number | null;
  volatility20dPct: number | null;
  change1wPct: number | null;
  change1mPct: number | null;
  change3mPct: number | null;
  change1yPct: number | null;
  high52w: number | null;
  low52w: number | null;
  turnover20dAvgRub: number | null;
  turnoverRatio20to60: number | null;
};

export type AnalysisResult = {
  signal: Signal;
  confidence: number;
  horizon: 'days' | 'weeks' | 'months';
  summary: string;
  trend: string;
  bullish: string[];
  bearish: string[];
  risks: string[];
  levels: { support: number[]; resistance: number[] };
  plan: string;
  answer?: string | null;
};

export type Analysis = {
  id: number;
  secid: string;
  shortname: string;
  createdAt: string;
  model: string;
  price: number;
  signal: Signal;
  confidence: number;
  question: string | null;
  result: AnalysisResult;
  indicators: Indicators;
};

export type ReviewPick = { secid: string; reason: string };

export type Review = {
  id: number;
  createdAt: string;
  model: string;
  secids: string[];
  result: {
    summary: string;
    market: string;
    items: { secid: string; signal: Signal; confidence: number; comment: string }[];
    top: ReviewPick[];
    avoid: ReviewPick[];
    risks: string[];
  };
  snapshot: { secid: string; name: string; price: number | null; changeTodayPct: number; indicators: Indicators }[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Ошибка ${res.status}`);
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  me: () => request<{ ok: true }>('GET', '/auth/me'),
  login: (password: string) => request<{ ok: true }>('POST', '/auth/login', { password }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),

  search: (q: string) => request<SearchResult[]>('GET', `/market/search?q=${enc(q)}`),
  quote: (secid: string) => request<Quote>('GET', `/market/quote/${enc(secid)}`),
  candles: (secid: string, interval: number, from: string) =>
    request<Candle[]>('GET', `/market/candles/${enc(secid)}?interval=${interval}&from=${from}`),

  watchlist: () => request<WatchItem[]>('GET', '/watchlist'),
  watch: (secid: string) => request('PUT', `/watchlist/${enc(secid)}`),
  unwatch: (secid: string) => request('DELETE', `/watchlist/${enc(secid)}`),

  aiStatus: () => request<{ configured: boolean; model: string }>('GET', '/analysis/status'),
  indicators: (secid: string) => request<Indicators>('GET', `/analysis/indicators/${enc(secid)}`),
  analyses: (secid?: string) => request<Analysis[]>('GET', `/analysis${secid ? `?secid=${enc(secid)}` : ''}`),
  analysis: (id: number) => request<Analysis>('GET', `/analysis/${id}`),
  analyze: (secid: string, question?: string) => request<Analysis>('POST', `/analysis/${enc(secid)}`, { question }),
  deleteAnalysis: (id: number) => request('DELETE', `/analysis/${id}`),

  reviews: () => request<Review[]>('GET', '/review'),
  createReview: () => request<Review>('POST', '/review'),
  deleteReview: (id: number) => request('DELETE', `/review/${id}`),
};
