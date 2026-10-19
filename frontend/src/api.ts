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
  bull?: string;
  bear?: string;
  verdictReason?: string;
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

export type ReviewScope = 'watchlist' | 'imoex' | 'portfolio';

export type Review = {
  id: number;
  createdAt: string;
  model: string;
  scope: ReviewScope;
  status: 'running' | 'done' | 'failed';
  error: string | null;
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
  ofz: { y1: OfzPoint | null; y3: OfzPoint | null; y5: OfzPoint | null } | null;
  regime: { trend: 'uptrend' | 'recovery' | 'correction' | 'downtrend' | 'sideways'; volatility: 'low' | 'normal' | 'high'; label: string; reasons: string[] } | null;
};

export type RiskStats = { beta: number | null; maxDrawdownPct: number | null; worstDayPct: number | null; bestDayPct: number | null; days: number };

export type OfzPoint = { secid: string; name: string; maturity: string; yieldPct: number };

export type NewsItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  event?: string;
  sentiment?: number | null;
  impact?: string | null;
  tickers?: string[];
};

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

export type AnalystTarget = { company: string; recommendation: Signal; target: number | null; date: string | null };
export type Forecast = {
  consensus: { recommendation: Signal; target: number | null; min: number | null; max: number | null; upsidePct: number | null };
  targets: AnalystTarget[];
  counts: { buy: number; hold: number; sell: number };
};
export type InsiderDeal = { date: string | null; direction: 'buy' | 'sell'; quantity: number; price: number | null; who: string; position: string };

export type Outcome = {
  id: number;
  secid: string;
  shortname: string;
  createdAt: string;
  signal: Signal;
  confidence: number;
  price: number;
  returns: Record<'7' | '30', number | null>;
  hits: Record<'7' | '30', boolean | null>;
  returnNow: number | null;
};
export type Scorecard = {
  total: number;
  bySignal: Record<Signal, Record<'7' | '30', { settled: number; hits: number; meanReturnPct: number | null }>>;
  outcomes: Outcome[];
};

export type CalendarItem = Dividend & {
  secid: string;
  shortname: string;
  held: number;
  expectedPayoutRub: number | null;
  source: ('watchlist' | 'portfolio')[];
};

export type Pillar = { score: number; drivers: string[] };
export type Score = { total: number; label: 'strong' | 'neutral' | 'weak'; tech: Pillar; relative: Pillar; fundamental: Pillar | null };
export type ScreenerRow = {
  secid: string;
  shortname: string;
  weight: number;
  price: number | null;
  changePct: number;
  sector: string;
  score: Score;
  ratios: { pe: number | null; dividendYieldPct: number | null; roePct: number | null; change3mPct: number | null };
};
export type SectorWeight = { sector: string; weightPct: number; members: string[] };

export const SECTOR_RU: Record<string, string> = {
  energy: 'Нефть и газ',
  financial: 'Финансы',
  materials: 'Металлы и сырьё',
  it: 'Технологии',
  consumer: 'Потребительский сектор',
  telecom: 'Телеком',
  utilities: 'Электроэнергетика',
  industrials: 'Промышленность',
  health_care: 'Здравоохранение',
  real_estate: 'Недвижимость',
  fund: 'Фонды',
  other: 'Прочее',
};
export type Backtest = {
  horizonDays: number;
  dates: number;
  observations: number;
  strong: { n: number; hitRatePct: number | null; meanReturnPct: number | null };
  weak: { n: number; hitRatePct: number | null; meanReturnPct: number | null };
  neutral: { n: number; meanReturnPct: number | null };
  spreadPct: number | null;
  spreadWinRatePct: number | null;
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
        forecast: Forecast | null;
        insiders: InsiderDeal[];
      } | null;
    };

export type Position = {
  secid: string;
  name: string;
  sector: string;
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

export type Article = {
  url: string;
  title: string;
  siteName: string | null;
  byline: string | null;
  paragraphs: string[];
  fallback: boolean;
  summary: string | null;
};

export type ArenaAgent = {
  id: number;
  name: string;
  persona: string;
  model: string | null;
  accountId: string | null;
  startCapital: number;
  status: 'active' | 'stopped';
  stopReason: string | null;
  createdAt: string;
  group: ArenaGroupKey;
  tagline: string;
  equity: number;
  cash: number;
  positions: number;
  returnPct: number;
  maxDrawdownPct: number;
  sharpe: number | null;
  trades: number;
  feesRub: number;
  running: boolean;
  lastRunAt: string | null;
  curve: { day: string; equity: number }[];
  effectiveModel: string;
  lastAction: string | null;
  lastActionAt: string | null;
};

export type ArenaGroupKey = 'main' | 'models' | 'styles';

export type ArenaGroup = {
  key: ArenaGroupKey;
  title: string;
  description: string;
  since: string | null;
  benchmarks: { imoexPct: number | null; ofzPct: number | null };
  agents: ArenaAgent[];
};

export type Arena = {
  configured: boolean;
  models: { id: string; label: string; local: boolean }[];
  personas: { key: string; name: string; tagline: string }[];
  risk: { maxPositionPct: number; maxOrdersPerRun: number; maxTradesPerWeek: number; drawdownStopPct: number };
  runHoursMsk: number[];
  paused: boolean;
  roundRunning: boolean;
  groups: ArenaGroup[];
};

export type ArenaOrder = {
  secid: string;
  direction: 'buy' | 'sell';
  lots: number;
  amountRub: number;
  status: 'filled' | 'rejected' | 'failed';
  reason: string;
  orderId?: string;
};

export type ArenaRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'done' | 'failed';
  error: string | null;
  model: string | null;
  equityBefore: number | null;
  marketView: string | null;
  reasoning: string | null;
  proposed: { secid: string; direction: 'buy' | 'sell'; amountRub?: number; sellAll?: boolean; reason: string }[];
  executed: ArenaOrder[];
};

export type ArenaAgentDetail = {
  agent: Omit<ArenaAgent, 'equity' | 'cash' | 'positions' | 'returnPct' | 'maxDrawdownPct' | 'sharpe' | 'trades' | 'feesRub' | 'lastRunAt' | 'curve'> & { style: string };
  portfolio: Portfolio | null;
  runs: ArenaRun[];
  curve: { day: string; equity: number; imoex: number | null }[];
};

export type AuthStatus = { totpEnabled: boolean; passkeys: number; rpId: string };
export type Passkey = { id: number; name: string; createdAt: string; lastUsedAt: string | null };

export type ImoexMember = { secid: string; shortname: string; weight: number; sector: string; quote: Quote | null };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Called on any 401 except the session probe itself, so an expired session sends the user back to login. */
export let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // A wrong password on the security page is also a 401; only non-auth routes mean the session is gone.
    if (res.status === 401 && !path.startsWith('/auth/')) onUnauthorized();
    throw new ApiError(res.status, data.error ?? `Ошибка ${res.status}`);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  me: () => request<{ ok: true }>('GET', '/auth/me'),
  login: (password: string, code?: string) => request<{ ok: true }>('POST', '/auth/login', { password, code }),
  logout: () => request<{ ok: true }>('POST', '/auth/logout'),
  authStatus: () => request<AuthStatus>('GET', '/auth/status'),
  totpSetup: (password: string) => request<{ secret: string; qr: string }>('POST', '/auth/2fa/setup', { password }),
  totpEnable: (code: string) => request('POST', '/auth/2fa/enable', { code }),
  totpReset: () => request('POST', '/auth/2fa/reset'),
  totpDisable: (password: string, code: string) => request('POST', '/auth/2fa/disable', { password, code }),
  passkeys: () => request<Passkey[]>('GET', '/auth/passkeys'),
  passkeyRegisterOptions: (password: string) => request<unknown>('POST', '/auth/passkeys/register/options', { password }),
  passkeyRegisterVerify: (name: string, response: unknown) => request('POST', '/auth/passkeys/register/verify', { name, response }),
  passkeyRemove: (id: number, password: string) => request('DELETE', `/auth/passkeys/${id}`, { password }),
  passkeyLoginOptions: () => request<unknown>('POST', '/auth/passkeys/login/options'),
  passkeyLoginVerify: (response: unknown) => request<{ ok: true }>('POST', '/auth/passkeys/login/verify', response),

  search: (q: string) => request<SearchResult[]>('GET', `/market/search?q=${enc(q)}`),
  quote: (secid: string) => request<Quote>('GET', `/market/quote/${enc(secid)}`),
  context: () => request<MarketContext>('GET', '/market/context'),
  imoex: () => request<ImoexMember[]>('GET', '/market/imoex'),
  company: (secid: string) => request<CompanyInfo>('GET', `/market/company/${enc(secid)}`),
  sparklines: (secids: string[]) =>
    request<Record<string, number[]>>('GET', `/market/sparklines?secids=${secids.map(enc).join(',')}`),
  events: () => request<NewsItem[]>('GET', '/market/events'),
  article: (url: string) => request<Article>('GET', `/news/article?url=${enc(url)}`),
  marketNews: () => request<NewsItem[]>('GET', '/market/news'),
  news: (secid: string) => request<NewsItem[]>('GET', `/market/news/${enc(secid)}`),
  candles: (secid: string, interval: number, from: string) =>
    request<Candle[]>('GET', `/market/candles/${enc(secid)}?interval=${interval}&from=${from}`),

  watchlist: () => request<WatchItem[]>('GET', '/watchlist'),
  watch: (secid: string) => request('PUT', `/watchlist/${enc(secid)}`),
  unwatch: (secid: string) => request('DELETE', `/watchlist/${enc(secid)}`),

  aiStatus: () => request<{ configured: boolean; model: string }>('GET', '/analysis/status'),
  indicators: (secid: string) => request<Indicators>('GET', `/analysis/indicators/${enc(secid)}`),
  dividendCalendar: () => request<{ upcoming: CalendarItem[]; recent: CalendarItem[] }>('GET', '/calendar/dividends'),
  briefRun: () => request('POST', '/brief/run'),
  briefStatus: () => request<{ running: boolean }>('GET', '/brief/status'),
  digestStatus: () => request<{ configured: boolean }>('GET', '/digest/status'),
  digestPreview: () => request<{ text: string }>('GET', '/digest/preview'),
  digestSend: () => request('POST', '/digest/send'),
  screener: () => request<ScreenerRow[]>('GET', '/screener'),
  sectors: () => request<SectorWeight[]>('GET', '/screener/sectors'),
  peers: (secid: string) => request<{ sector: string | null; peers: ScreenerRow[] }>('GET', `/screener/peers/${enc(secid)}`),
  score: (secid: string) => request<Score>('GET', `/screener/${enc(secid)}`),
  backtest: (horizon: 10 | 20 | 60) => request<Backtest>('GET', `/screener/backtest?horizon=${horizon}`),
  risk: (secid: string) => request<RiskStats>('GET', `/analysis/risk/${enc(secid)}`),
  scorecard: () => request<Scorecard>('GET', '/analysis/scorecard'),
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

  arena: () => request<Arena>('GET', '/arena'),
  arenaSetup: (group: ArenaGroupKey, capital: number) => request('POST', `/arena/groups/${group}`, { capital }),
  arenaTeardown: (group: ArenaGroupKey) => request('DELETE', `/arena/groups/${group}`),
  arenaPause: (paused: boolean) => request('POST', paused ? '/arena/pause' : '/arena/resume'),
  arenaRunAll: () => request('POST', '/arena/run'),
  arenaAgent: (id: number) => request<ArenaAgentDetail>('GET', `/arena/agents/${id}`),
  arenaRunAgent: (id: number) => request('POST', `/arena/agents/${id}/run`),
  arenaAgentStatus: (id: number, status: 'stop' | 'resume') => request('POST', `/arena/agents/${id}/${status}`),
  arenaSetModel: (id: number, model: string | null) => request('PUT', `/arena/agents/${id}/model`, { model }),

  reviews: (scope: ReviewScope) => request<Review[]>('GET', `/review?scope=${scope}`),
  createReview: (scope: ReviewScope) => request<Review>('POST', '/review', { scope }),
  review: (id: number) => request<Review>('GET', `/review/${id}`),
  deleteReview: (id: number) => request('DELETE', `/review/${id}`),
};
