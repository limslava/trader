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
  simple?: string;
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

export type ReviewScope = 'watchlist' | 'imoex';

export type Review = {
  id: number;
  createdAt: string;
  model: string;
  scope: ReviewScope;
  secids: string[];
  result: {
    summary: string;
    simple?: string;
    market: string;
    items: { secid: string; signal: Signal; confidence: number; comment: string }[];
    top: ReviewPick[];
    avoid: ReviewPick[];
    risks: string[];
  };
  snapshot: { secid: string; name: string; price: number | null; changeTodayPct: number; indicators: Indicators }[];
};

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

export type NewsItem = { title: string; source: string; url: string; publishedAt: string };

export type Dividend = {
  recordDate: string | null;
  lastBuyDate: string | null;
  paymentDate: string | null;
  declaredDate: string | null;
  amount: number | null;
  currency: string | null;
  yieldPct: number | null;
  regularity: string | null;
};

export type CompanyInfo =
  | { configured: false }
  | {
      configured: true;
      sandbox: boolean;
      labels: Record<string, string>;
      data: {
        fundamentals: Record<string, number | string | null> | null;
        dividends: { upcoming: Dividend[]; recent: Dividend[] };
      } | null;
    };

export type Position = {
  secid: string;
  name: string;
  quantity: number;
  lots: number;
  blockedLots: number;
  averagePrice: number | null;
  currentPrice: number | null;
  value: number | null;
  expectedYield: number | null;
};

export type Portfolio = {
  accountId: string;
  total: number | null;
  cash: number;
  blockedCash: number;
  availableCash: number;
  positions: Position[];
};

export type TradeInstrument = {
  secid: string;
  name: string;
  lot: number;
  minPriceIncrement: number;
  lastPrice: number | null;
  lastPriceTime: string | null;
  canTrade: boolean;
  marketOrderAvailable: boolean;
  limitOrderAvailable: boolean;
  status: string;
};

export type Order = {
  orderId: string;
  secid: string;
  status: string;
  statusText: string;
  direction: 'buy' | 'sell';
  type: 'market' | 'limit';
  lotsRequested: number;
  lotsExecuted: number;
  price: number | null;
  executedAmount: number | null;
  totalAmount: number | null;
  commission: number | null;
  createdAt: string | null;
  message: string | null;
};

export type Operation = {
  id: string;
  date: string;
  title: string;
  operationType: string;
  secid: string | null;
  quantity: number;
  price: number | null;
  payment: number | null;
};

export type OrderInput = { secid: string; direction: 'buy' | 'sell'; lots: number; type: 'market' | 'limit'; price?: number };

export type ImoexMember = { secid: string; shortname: string; weight: number; quote: Quote | null };

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
  context: () => request<MarketContext>('GET', '/market/context'),
  imoex: () => request<ImoexMember[]>('GET', '/market/imoex'),
  company: (secid: string) => request<CompanyInfo>('GET', `/market/company/${enc(secid)}`),
  sparklines: (secids: string[]) =>
    request<Record<string, number[]>>('GET', `/market/sparklines?secids=${secids.map(enc).join(',')}`),
  marketNews: () => request<NewsItem[]>('GET', '/market/news'),
  news: (secid: string) => request<NewsItem[]>('GET', `/market/news/${enc(secid)}`),
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

  tradingStatus: () => request<{ configured: boolean; sandbox: boolean }>('GET', '/trading/status'),
  openAccount: (amount: number) => request('POST', '/trading/account', { amount }),
  payIn: (amount: number) => request('POST', '/trading/account/payin', { amount }),
  portfolio: () => request<Portfolio>('GET', '/trading/portfolio'),
  tradeInstrument: (secid: string) => request<TradeInstrument>('GET', `/trading/instrument/${enc(secid)}`),
  orders: () => request<Order[]>('GET', '/trading/orders'),
  placeOrder: (input: OrderInput) => request<Order>('POST', '/trading/orders', input),
  cancelOrder: (orderId: string) => request('DELETE', `/trading/orders/${enc(orderId)}`),
  operations: () => request<Operation[]>('GET', '/trading/operations'),

  reviews: (scope: ReviewScope) => request<Review[]>('GET', `/review?scope=${scope}`),
  createReview: (scope: ReviewScope) => request<Review>('POST', '/review', { scope }),
  deleteReview: (id: number) => request('DELETE', `/review/${id}`),
};
