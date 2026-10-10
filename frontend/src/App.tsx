import { useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';
const TOKEN_STORAGE_KEY = 'rt_token';

type HealthResponse = {
  status: string;
  timestamp: string;
  service: string;
  jetstream?: {
    healthy: boolean;
    rttMs: number | null;
  };
};

type MetricsResponse = {
  orders?: Array<{ status: string; count: number }>;
  execution?: {
    queued: number;
    accepted: number;
    rejected: number;
  };
  latency?: {
    queued?: Record<string, number>;
    executed?: Record<string, number>;
  };
  percentiles?: {
    p50: number | null;
    p95: number | null;
    p99: number | null;
    windowMinutes: number;
  };
  queue?: any;
  consumer?: any;
  lag?: any;
  lagTrend?: {
    points: Array<{ pending: number; ackPending: number; delivered: number; ts: string }>;
    deltaPending: number;
    deltaAckPending: number;
    ratePerMin: number;
  } | null;
  alert?: any;
  recentTicks?: Array<{ exchange: string; symbol: string; last_ts: string }>;
  errors?: {
    routedRejections?: Array<{ message: string; count: number }>;
    lastErrors?: Array<{ last_error: string; count: number }>;
  };
};

type RiskPolicy = {
  maxNotional?: number | null;
  maxDailyNotional?: number | null;
  maxOpenNotional?: number | null;
  maxQtyPerOrder?: number | null;
  maxOpenOrders?: number | null;
  maxDailyOrders?: number | null;
  maxOpenQtyPerSymbol?: number | null;
  maxOpenNotionalPerSymbol?: number | null;
  maxPositionQtyPerSymbol?: number | null;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  role?: string;
};

type BrokerAccount = {
  id: string;
  broker: string;
  account_number: string;
  currency: string;
  environment: string;
  is_active: boolean;
};

type PortfolioPosition = {
  broker_account_id: string | null;
  symbol: string;
  net_qty: number;
  avg_price: number;
  buy_qty: number;
  sell_qty: number;
  last_price?: number | null;
  last_ts?: number | null;
  unrealized_pnl?: number | null;
};

type Instrument = {
  id: string;
  exchange: string;
  symbol: string;
  name: string | null;
  lot_size: number;
  tick_size: number;
  currency: string;
  instrument_id?: string | null;
};

type MarketSession = {
  market: string;
  timezone: string;
  now: string;
  open: boolean;
  reason: string;
  window: { open: string; close: string };
  note?: string;
};

type Order = {
  id: string;
  symbol: string;
  side: string;
  order_type: string;
  quantity: number;
  price: number | null;
  status: string;
  created_at: string;
};

type OrderEvent = {
  id: string;
  event_type: string;
  payload: any;
  created_at: string;
};

type TrendPoint = {
  label: string;
  values: number[];
};

const formatNumber = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  return Intl.NumberFormat('ru-RU').format(value);
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('ru-RU', { hour12: false });
};

const isForbiddenMessage = (message: string | null | undefined) => {
  if (!message) return false;
  const text = message.toLowerCase();
  return (
    text.includes('forbidden') ||
    text.includes('not available for trading') ||
    text.includes('instrument is not available') ||
    text.includes('instrument forbidden')
  );
};

const resolveErrorMessage = (payload: any, map: Record<string, string>) => {
  const code = payload?.errorCode;
  if (code && map && map[String(code)]) {
    return map[String(code)];
  }
  return payload?.message;
};

const StatusPill = ({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' }) => (
  <span className={`pill pill--${tone}`}>{label}</span>
);

const Sparkline = ({ values }: { values: number[] }) => {
  if (!values.length) return <div className="sparkline__empty">Нет данных</div>;
  const width = 160;
  const height = 40;
  const max = Math.max(1, ...values);
  const min = Math.min(...values);
  const range = Math.max(1, max - min);
  const points = values.map((value, index) => {
    const x = (index / Math.max(1, values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points.join(' ')} fill="none" stroke="url(#spark)" strokeWidth="2" />
      <defs>
        <linearGradient id="spark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0d4a3d" />
          <stop offset="1" stopColor="#cba35c" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [publicMetrics, setPublicMetrics] = useState<MetricsResponse | null>(null);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderEvents, setOrderEvents] = useState<OrderEvent[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [brokerAccounts, setBrokerAccounts] = useState<BrokerAccount[]>([]);
  const [selectedBrokerAccountId, setSelectedBrokerAccountId] = useState<string>('');
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [instrumentQuery, setInstrumentQuery] = useState('');
  const [marketSession, setMarketSession] = useState<MarketSession | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [sandboxName, setSandboxName] = useState('Sandbox main');
  const [sandboxAmount, setSandboxAmount] = useState('100000');
  const [sandboxCurrency, setSandboxCurrency] = useState('RUB');
  const [syncBrokerAccountId, setSyncBrokerAccountId] = useState('');
  const [orderSymbol, setOrderSymbol] = useState('SBER');
  const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('limit');
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [orderPrice, setOrderPrice] = useState('250');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [simulateBroker, setSimulateBroker] = useState<'tinkoff' | 'sber'>('tinkoff');
  const [simulateStatus, setSimulateStatus] = useState('filled');
  const [simulateFilledQty, setSimulateFilledQty] = useState('1');
  const [simulatePrice, setSimulatePrice] = useState('250');
  const [simulateTradeId, setSimulateTradeId] = useState('');
  const [simulateSubmitting, setSimulateSubmitting] = useState(false);
  const [simulateStatusText, setSimulateStatusText] = useState<string | null>(null);
  const [syncSubmitting, setSyncSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [instrumentStatus, setInstrumentStatus] = useState<string | null>(null);
  const [tradingStatus, setTradingStatus] = useState<string | null>(null);
  const [lagThreshold, setLagThreshold] = useState('1000');
  const [lagCriticalThreshold, setLagCriticalThreshold] = useState('5000');
  const [policySaving, setPolicySaving] = useState(false);
  const [policyStatus, setPolicyStatus] = useState<string | null>(null);
  const [riskPolicySaving, setRiskPolicySaving] = useState(false);
  const [riskPolicyStatus, setRiskPolicyStatus] = useState<string | null>(null);
  const [riskMaxNotional, setRiskMaxNotional] = useState('');
  const [riskMaxDailyNotional, setRiskMaxDailyNotional] = useState('');
  const [riskMaxOpenNotional, setRiskMaxOpenNotional] = useState('');
  const [riskMaxQtyPerOrder, setRiskMaxQtyPerOrder] = useState('');
  const [riskMaxOpenOrders, setRiskMaxOpenOrders] = useState('');
  const [riskMaxDailyOrders, setRiskMaxDailyOrders] = useState('');
  const [riskMaxOpenQtyPerSymbol, setRiskMaxOpenQtyPerSymbol] = useState('');
  const [riskMaxOpenNotionalPerSymbol, setRiskMaxOpenNotionalPerSymbol] = useState('');
  const [riskMaxPositionQtyPerSymbol, setRiskMaxPositionQtyPerSymbol] = useState('');
  const [activeView, setActiveView] = useState<'overview' | 'metrics' | 'analytics' | 'tenants' | 'orders' | 'portfolio' | 'instruments'>('overview');
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginTenant, setLoginTenant] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [analyticsSnapshots, setAnalyticsSnapshots] = useState<AnalyticsSnapshot[]>([]);
  const [analyticsWindow, setAnalyticsWindow] = useState('60');
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsStatus, setAnalyticsStatus] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [portfolioPositions, setPortfolioPositions] = useState<PortfolioPosition[]>([]);
  const [portfolioSyncing, setPortfolioSyncing] = useState(false);
  const [portfolioStatus, setPortfolioStatus] = useState<string | null>(null);
  const [tinkoffErrorMap, setTinkoffErrorMap] = useState<Record<string, string>>({});
  const [tinkoffErrorCode, setTinkoffErrorCode] = useState('');
  const [tinkoffErrorMessage, setTinkoffErrorMessage] = useState('');
  const [tinkoffErrorStatus, setTinkoffErrorStatus] = useState<string | null>(null);
  const [tinkoffErrorSaving, setTinkoffErrorSaving] = useState(false);
  const [tinkoffErrorSeeding, setTinkoffErrorSeeding] = useState(false);
  const [trend, setTrend] = useState<TrendPoint[]>([
    { label: 'P95', values: [] },
    { label: 'Queue', values: [] },
    { label: 'Lag', values: [] }
  ]);

  const refresh = async () => {
    try {
      setError(null);
      const [healthRes, publicRes] = await Promise.all([
        fetch(`${API_BASE}/health`),
        fetch(`${API_BASE}/api/metrics/public`)
      ]);
      if (!healthRes.ok) throw new Error(`Health: ${healthRes.status}`);
      if (!publicRes.ok) throw new Error(`Metrics public: ${publicRes.status}`);
      const healthJson = (await healthRes.json()) as HealthResponse;
      const publicJson = (await publicRes.json()) as MetricsResponse;

      setHealth(healthJson);
      setPublicMetrics(publicJson);
      setLastUpdated(new Date());
      setTrend((prev) => {
        const next = [...prev];
        const p95 = publicJson.percentiles?.p95 ?? 0;
        const queue = publicJson.execution?.queued ?? 0;
        const lag = publicJson.lag?.num_pending ?? 0;
        const updated = [
          { label: 'P95', value: p95 },
          { label: 'Queue', value: queue },
          { label: 'Lag', value: lag }
        ];
        return next.map((item) => {
          const nextValues = [...item.values, updated.find((u) => u.label === item.label)!.value];
          return {
            ...item,
            values: nextValues.slice(-30)
          };
        });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  };

  const refreshPrivate = async (authToken: string) => {
    try {
      setError(null);
      const [metricsRes, ordersRes, tenantsRes, brokersRes, instrumentsRes, sessionRes, policyRes, riskPolicyRes, snapshotsRes, aiRes, tinkoffErrorsRes, portfolioRes] = await Promise.all([
        fetch(`${API_BASE}/api/metrics`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/orders`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/tenants`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/brokers`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/instruments`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/market/session`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/queue-policy`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/risk-policy`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/analytics/snapshots`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/ai/insights`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/tinkoff-errors`, {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch(`${API_BASE}/api/portfolio`, {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      ]);
      if (!metricsRes.ok) throw new Error(`Metrics: ${metricsRes.status}`);
      if (!ordersRes.ok) throw new Error(`Orders: ${ordersRes.status}`);
      if (!tenantsRes.ok) throw new Error(`Tenants: ${tenantsRes.status}`);
      if (!brokersRes.ok) throw new Error(`Brokers: ${brokersRes.status}`);
      if (!instrumentsRes.ok) throw new Error(`Instruments: ${instrumentsRes.status}`);
      if (!sessionRes.ok) throw new Error(`Market session: ${sessionRes.status}`);
      if (!policyRes.ok) throw new Error(`Queue policy: ${policyRes.status}`);
      if (!riskPolicyRes.ok) throw new Error(`Risk policy: ${riskPolicyRes.status}`);
      if (!snapshotsRes.ok) throw new Error(`Analytics: ${snapshotsRes.status}`);
      if (!aiRes.ok) throw new Error(`AI insights: ${aiRes.status}`);
      if (!tinkoffErrorsRes.ok && tinkoffErrorsRes.status !== 403) {
        throw new Error(`Tinkoff errors: ${tinkoffErrorsRes.status}`);
      }
      if (!portfolioRes.ok) throw new Error(`Portfolio: ${portfolioRes.status}`);
      const metricsJson = (await metricsRes.json()) as MetricsResponse;
      const ordersJson = (await ordersRes.json()) as { orders: Order[] };
      const tenantsJson = (await tenantsRes.json()) as { tenants: Tenant[] };
      const brokersJson = (await brokersRes.json()) as { accounts: BrokerAccount[] };
      const instrumentsJson = (await instrumentsRes.json()) as { instruments: Instrument[] };
      const sessionJson = (await sessionRes.json()) as MarketSession;
      const policyJson = (await policyRes.json()) as { queue?: { lagThreshold?: number; lagCriticalThreshold?: number } };
      const riskPolicyJson = (await riskPolicyRes.json()) as { risk?: RiskPolicy };
      const snapshotsJson = (await snapshotsRes.json()) as { snapshots: AnalyticsSnapshot[] };
      const aiJson = (await aiRes.json()) as { insights: AIInsight[] };
      const tinkoffErrorsJson = tinkoffErrorsRes.ok
        ? ((await tinkoffErrorsRes.json()) as { map: Record<string, string> })
        : { map: {} as Record<string, string> };
      const portfolioJson = (await portfolioRes.json()) as { positions: PortfolioPosition[] };
      setMetrics(metricsJson);
      setOrders(ordersJson.orders || []);
      setTenants(tenantsJson.tenants || []);
      setBrokerAccounts(brokersJson.accounts || []);
      setInstruments(instrumentsJson.instruments || []);
      setMarketSession(sessionJson);
      setAnalyticsSnapshots(snapshotsJson.snapshots || []);
      setAiInsights(aiJson.insights || []);
      setTinkoffErrorMap(tinkoffErrorsJson.map || {});
      setPortfolioPositions(portfolioJson.positions || []);
      if (policyJson.queue?.lagThreshold !== undefined) {
        setLagThreshold(String(policyJson.queue.lagThreshold));
      }
      if (policyJson.queue?.lagCriticalThreshold !== undefined) {
        setLagCriticalThreshold(String(policyJson.queue.lagCriticalThreshold));
      }
      const risk = riskPolicyJson.risk || {};
      if (risk.maxNotional !== undefined && risk.maxNotional !== null) setRiskMaxNotional(String(risk.maxNotional));
      if (risk.maxDailyNotional !== undefined && risk.maxDailyNotional !== null) setRiskMaxDailyNotional(String(risk.maxDailyNotional));
      if (risk.maxOpenNotional !== undefined && risk.maxOpenNotional !== null) setRiskMaxOpenNotional(String(risk.maxOpenNotional));
      if (risk.maxQtyPerOrder !== undefined && risk.maxQtyPerOrder !== null) setRiskMaxQtyPerOrder(String(risk.maxQtyPerOrder));
      if (risk.maxOpenOrders !== undefined && risk.maxOpenOrders !== null) setRiskMaxOpenOrders(String(risk.maxOpenOrders));
      if (risk.maxDailyOrders !== undefined && risk.maxDailyOrders !== null) setRiskMaxDailyOrders(String(risk.maxDailyOrders));
      if (risk.maxOpenQtyPerSymbol !== undefined && risk.maxOpenQtyPerSymbol !== null) setRiskMaxOpenQtyPerSymbol(String(risk.maxOpenQtyPerSymbol));
      if (risk.maxOpenNotionalPerSymbol !== undefined && risk.maxOpenNotionalPerSymbol !== null) setRiskMaxOpenNotionalPerSymbol(String(risk.maxOpenNotionalPerSymbol));
      if (risk.maxPositionQtyPerSymbol !== undefined && risk.maxPositionQtyPerSymbol !== null) setRiskMaxPositionQtyPerSymbol(String(risk.maxPositionQtyPerSymbol));
      if (!selectedBrokerAccountId && brokersJson.accounts?.length) {
        setSelectedBrokerAccountId(brokersJson.accounts[0].id);
      }
      if (!syncBrokerAccountId && brokersJson.accounts?.length) {
        setSyncBrokerAccountId(brokersJson.accounts[0].id);
      }
      if (ordersJson.orders?.length && !selectedOrder) {
        setSelectedOrder(ordersJson.orders[0]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  };

  const handleSaveQueuePolicy = async () => {
    if (!token) return;
    try {
      setPolicySaving(true);
      setPolicyStatus(null);
      const payload: { lagThreshold?: number; lagCriticalThreshold?: number } = {};
      if (lagThreshold.trim() !== '') payload.lagThreshold = Number(lagThreshold);
      if (lagCriticalThreshold.trim() !== '') payload.lagCriticalThreshold = Number(lagCriticalThreshold);
      const res = await fetch(`${API_BASE}/api/queue-policy`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Queue policy: ${res.status}`);
      const json = (await res.json()) as { queue?: { lagThreshold?: number; lagCriticalThreshold?: number } };
      if (json.queue?.lagThreshold !== undefined) {
        setLagThreshold(String(json.queue.lagThreshold));
      }
      if (json.queue?.lagCriticalThreshold !== undefined) {
        setLagCriticalThreshold(String(json.queue.lagCriticalThreshold));
      }
      setPolicyStatus('Политика обновлена');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setPolicyStatus(message);
    } finally {
      setPolicySaving(false);
    }
  };

  const handleSaveRiskPolicy = async () => {
    if (!token) return;
    try {
      setRiskPolicySaving(true);
      setRiskPolicyStatus(null);
      const payload: RiskPolicy = {
        maxNotional: riskMaxNotional.trim() === '' ? null : Number(riskMaxNotional),
        maxDailyNotional: riskMaxDailyNotional.trim() === '' ? null : Number(riskMaxDailyNotional),
        maxOpenNotional: riskMaxOpenNotional.trim() === '' ? null : Number(riskMaxOpenNotional),
        maxQtyPerOrder: riskMaxQtyPerOrder.trim() === '' ? null : Number(riskMaxQtyPerOrder),
        maxOpenOrders: riskMaxOpenOrders.trim() === '' ? null : Number(riskMaxOpenOrders),
        maxDailyOrders: riskMaxDailyOrders.trim() === '' ? null : Number(riskMaxDailyOrders),
        maxOpenQtyPerSymbol: riskMaxOpenQtyPerSymbol.trim() === '' ? null : Number(riskMaxOpenQtyPerSymbol),
        maxOpenNotionalPerSymbol: riskMaxOpenNotionalPerSymbol.trim() === '' ? null : Number(riskMaxOpenNotionalPerSymbol),
        maxPositionQtyPerSymbol: riskMaxPositionQtyPerSymbol.trim() === '' ? null : Number(riskMaxPositionQtyPerSymbol)
      };
      const res = await fetch(`${API_BASE}/api/risk-policy`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Risk policy: ${res.status}`);
      setRiskPolicyStatus('Сохранено');
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setRiskPolicyStatus(message);
      setError(message);
    } finally {
      setRiskPolicySaving(false);
    }
  };

  const handleGenerateSnapshot = async () => {
    if (!token) return;
    try {
      setAnalyticsLoading(true);
      setAnalyticsStatus(null);
      const res = await fetch(`${API_BASE}/api/analytics/snapshot?windowMinutes=${encodeURIComponent(analyticsWindow)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Analytics snapshot: ${res.status}`);
      const json = (await res.json()) as { id: string; snapshot: any };
      setAnalyticsSnapshots((prev) => [
        {
          id: json.id,
          window_minutes: json.snapshot.windowMinutes,
          payload: json.snapshot,
          created_at: new Date().toISOString()
        },
        ...prev
      ].slice(0, 20));
      setAnalyticsStatus('Снимок обновлен');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setAnalyticsStatus(message);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleGenerateAIInsight = async () => {
    if (!token) return;
    try {
      setAiLoading(true);
      setAiStatus(null);
      const res = await fetch(`${API_BASE}/api/ai/insights`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ windowMinutes: Number(analyticsWindow) || 60 })
      });
      if (!res.ok) throw new Error(`AI insights: ${res.status}`);
      const json = (await res.json()) as { insight: AIInsight };
      setAiInsights((prev) => [json.insight, ...prev].slice(0, 20));
      setAiStatus('Инсайт обновлен');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setAiStatus(message);
    } finally {
      setAiLoading(false);
    }
  };

  const loadOrderEvents = async (authToken: string, orderId: string) => {
    try {
      const eventsRes = await fetch(`${API_BASE}/api/orders/${orderId}/events`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (!eventsRes.ok) throw new Error(`Events: ${eventsRes.status}`);
      const eventsJson = (await eventsRes.json()) as { events: OrderEvent[] };
      setOrderEvents(eventsJson.events || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (storedToken) setToken(storedToken);
    void refresh();
    const timer = setInterval(() => void refresh(), 8000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) return;
    void refreshPrivate(token);
    const timer = setInterval(() => void refreshPrivate(token), 10000);
    return () => clearInterval(timer);
  }, [token]);

  useEffect(() => {
    if (!token || !selectedOrder) return;
    void loadOrderEvents(token, selectedOrder.id);
  }, [token, selectedOrder]);

  const orderStats = useMemo(() => {
    if (!metrics?.orders) return [];
    return metrics.orders.map((item) => ({
      label: item.status,
      value: item.count
    }));
  }, [metrics]);

  const forbiddenSymbols = useMemo(() => {
    const symbols = new Set<string>();
    if (selectedOrder && orderEvents.some((event) => isForbiddenMessage(resolveErrorMessage(event.payload, tinkoffErrorMap)))) {
      symbols.add(selectedOrder.symbol.toUpperCase());
    }
    return symbols;
  }, [orderEvents, selectedOrder, tinkoffErrorMap]);

  const publicLatency = publicMetrics?.latency;
  const privateLatency = metrics?.latency;
  const latencyBars = useMemo(() => {
    const source = privateLatency?.executed || publicLatency?.executed || {};
    return [
      { label: '<1s', value: source.le_1s || 0 },
      { label: '<5s', value: source.le_5s || 0 },
      { label: '<30s', value: source.le_30s || 0 },
      { label: '<60s', value: source.le_60s || 0 },
      { label: '>60s', value: source.gt_60s || 0 }
    ];
  }, [privateLatency, publicLatency]);

  const maxLatency = Math.max(1, ...latencyBars.map((item) => item.value));

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
          tenantSlug: loginTenant || undefined
        })
      });
      if (!res.ok) throw new Error(`Login: ${res.status}`);
      const json = await res.json();
      const receivedToken = json.token as string;
      localStorage.setItem(TOKEN_STORAGE_KEY, receivedToken);
      setToken(receivedToken);
      setLoginEmail('');
      setLoginPassword('');
      setLoginTenant('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
    setMetrics(null);
    setOrders([]);
    setSelectedOrder(null);
    setOrderEvents([]);
    setTenants([]);
    setBrokerAccounts([]);
    setSelectedBrokerAccountId('');
    setSyncBrokerAccountId('');
    setInstruments([]);
    setMarketSession(null);
  };

  const handleCreateTenant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/tenants`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: tenantName,
          slug: tenantSlug
        })
      });
      if (!res.ok) throw new Error(`Create tenant: ${res.status}`);
      setTenantName('');
      setTenantSlug('');
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  };

  const handleSandboxSetup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/tinkoff/sandbox/setup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: sandboxName,
          payInAmount: Number(sandboxAmount),
          currency: sandboxCurrency
        })
      });
      if (!res.ok) throw new Error(`Sandbox setup: ${res.status}`);
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    }
  };

  const handleSyncInstruments = async (mode: 'basic' | 'full') => {
    if (!token || !syncBrokerAccountId) return;
    setSyncSubmitting(true);
    setSyncStatus(null);
    try {
      const endpoint = mode === 'full' ? 'sync-instruments-full' : 'sync-instruments';
      const res = await fetch(`${API_BASE}/api/tinkoff/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ brokerAccountId: syncBrokerAccountId })
      });
      if (!res.ok) throw new Error(`Sync instruments: ${res.status}`);
      const json = await res.json();
      setSyncStatus(`Synced: ${json.synced ?? 0}`);
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSyncStatus(message);
      setError(message);
    } finally {
      setSyncSubmitting(false);
    }
  };

  const handleCreateOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !selectedBrokerAccountId) return;
    setOrderSubmitting(true);
    setInstrumentStatus(null);
    try {
      const payload: any = {
        symbol: orderSymbol.toUpperCase(),
        side: orderSide,
        type: orderType,
        quantity: Number(orderQuantity),
        accountId: selectedBrokerAccountId
      };
      if (orderType === 'limit') {
        payload.price = Number(orderPrice);
      }
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Create order: ${res.status}`);
      const json = await res.json();
      const brokerMessage = json?.broker?.message as string | undefined;
      if (brokerMessage && brokerMessage.toLowerCase().includes('forbidden')) {
        setInstrumentStatus('Instrument forbidden for trading by API. Проверьте тикер и доступность в Tinkoff.');
      }
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleValidateInstrument = async () => {
    if (!token || !selectedBrokerAccountId || !orderSymbol) return;
    setInstrumentStatus(null);
    setTradingStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/tinkoff/validate-instrument`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brokerAccountId: selectedBrokerAccountId,
          symbol: orderSymbol
        })
      });
      if (!res.ok) throw new Error(`Validate instrument: ${res.status}`);
      const json = await res.json();
      const instruments = json.instruments || [];
      if (!instruments.length) {
        setInstrumentStatus('Инструмент не найден в Tinkoff.');
      } else {
        const first = instruments[0];
        setInstrumentStatus(`Найдено: ${first.ticker || orderSymbol} · ${first.classCode || first.class_code || '—'} · ${first.uid || first.figi || 'no id'}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setInstrumentStatus(message);
    }
  };

  const handleTradingStatus = async () => {
    if (!token || !selectedBrokerAccountId || !orderSymbol) return;
    setTradingStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/tinkoff/trading-status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brokerAccountId: selectedBrokerAccountId,
          symbol: orderSymbol
        })
      });
      if (!res.ok) throw new Error(`Trading status: ${res.status}`);
      const json = await res.json();
      const status = json.tradingStatus?.tradingStatus || json.tradingStatus?.tradeStatus || 'unknown';
      setTradingStatus(`Trading status: ${status}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTradingStatus(message);
    }
  };

  const handleSimulateWebhook = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !selectedOrder) return;
    setSimulateSubmitting(true);
    setSimulateStatusText(null);
    try {
      const payload: any = {
        broker: simulateBroker,
        orderId: selectedOrder.id
      };
      if (simulateStatus.trim()) payload.status = simulateStatus.trim();
      if (simulateFilledQty.trim()) payload.filledQty = Number(simulateFilledQty);
      if (simulatePrice.trim()) payload.price = Number(simulatePrice);
      if (simulateTradeId.trim()) payload.brokerTradeId = simulateTradeId.trim();

      const res = await fetch(`${API_BASE}/api/broker-callbacks/simulate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`Simulate webhook: ${res.status}`);
      const json = await res.json();
      setSimulateStatusText(`Simulated: ${json.status}`);
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSimulateStatusText(message);
      setError(message);
    } finally {
      setSimulateSubmitting(false);
    }
  };

  const handleSyncPortfolioTicks = async () => {
    if (!token) return;
    setPortfolioSyncing(true);
    setPortfolioStatus(null);
    try {
      const symbols = portfolioPositions.map((pos) => pos.symbol);
      if (symbols.length === 0) {
        setPortfolioStatus('Нет позиций для синка.');
        return;
      }
      const res = await fetch(`${API_BASE}/api/market/ticks/sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ symbols })
      });
      if (!res.ok) throw new Error(`Tick sync: ${res.status}`);
      const json = await res.json();
      setPortfolioStatus(`Synced: ${json.synced ?? 0}`);
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setPortfolioStatus(message);
      setError(message);
    } finally {
      setPortfolioSyncing(false);
    }
  };

  const handleSaveTinkoffError = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    if (!tinkoffErrorCode || !tinkoffErrorMessage) return;
    setTinkoffErrorSaving(true);
    setTinkoffErrorStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/tinkoff-errors`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: tinkoffErrorCode,
          message: tinkoffErrorMessage
        })
      });
      if (!res.ok) throw new Error(`Tinkoff errors update: ${res.status}`);
      setTinkoffErrorCode('');
      setTinkoffErrorMessage('');
      setTinkoffErrorStatus('Сохранено');
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTinkoffErrorStatus(message);
      setError(message);
    } finally {
      setTinkoffErrorSaving(false);
    }
  };

  const handleSeedTinkoffErrors = async () => {
    if (!token) return;
    setTinkoffErrorSeeding(true);
    setTinkoffErrorStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/tinkoff-errors/seed`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error(`Tinkoff errors seed: ${res.status}`);
      const json = await res.json();
      setTinkoffErrorStatus(`Сидировано: ${json.count ?? 0}`);
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTinkoffErrorStatus(message);
      setError(message);
    } finally {
      setTinkoffErrorSeeding(false);
    }
  };

  const handleBackfillTinkoffErrors = async () => {
    if (!token) return;
    setTinkoffErrorSeeding(true);
    setTinkoffErrorStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/tinkoff-errors/backfill`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error(`Tinkoff errors backfill: ${res.status}`);
      const json = await res.json();
      setTinkoffErrorStatus(`Backfill: ${json.routedUpdated ?? 0} events, ${json.ordersUpdated ?? 0} orders`);
      await refreshPrivate(token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setTinkoffErrorStatus(message);
      setError(message);
    } finally {
      setTinkoffErrorSeeding(false);
    }
  };

  if (!token) {
    return (
      <div className="app login-screen">
        <div className="login-panel">
          <div className="login-panel__card login-panel__card--wide">
            <div className="login-title">Russian Trader</div>
            <div className="card__header">
              <h2>Вход</h2>
              <StatusPill label="Login required" tone="warn" />
            </div>
            <div className="card__body">
              <form className="login" onSubmit={handleLogin}>
                <label>
                  Email
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder="admin@lcl.local"
                    required
                  />
                </label>
                <label>
                  Пароль
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </label>
                <label>
                  Tenant slug (опционально)
                  <input
                    type="text"
                    value={loginTenant}
                    onChange={(event) => setLoginTenant(event.target.value)}
                    placeholder="default"
                  />
                </label>
                <button type="submit" disabled={loginLoading}>
                  {loginLoading ? 'Входим…' : 'Войти'}
                </button>
              </form>
            </div>
          </div>
          {error && (
            <div className="toast">
              <strong>Ошибка:</strong> {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Control Room</p>
          <h1>Russian Trader</h1>
        </div>
        <nav className="nav">
          <button className={activeView === 'overview' ? 'nav__item nav__item--active' : 'nav__item'} onClick={() => setActiveView('overview')}>
            Overview
          </button>
          <button className={activeView === 'metrics' ? 'nav__item nav__item--active' : 'nav__item'} onClick={() => setActiveView('metrics')}>
            Metrics
          </button>
          <button className={activeView === 'analytics' ? 'nav__item nav__item--active' : 'nav__item'} onClick={() => setActiveView('analytics')}>
            Analytics
          </button>
          <button className={activeView === 'instruments' ? 'nav__item nav__item--active' : 'nav__item'} onClick={() => setActiveView('instruments')}>
            Instruments
          </button>
          <button className={activeView === 'orders' ? 'nav__item nav__item--active' : 'nav__item'} onClick={() => setActiveView('orders')}>
            Orders
          </button>
          <button className={activeView === 'tenants' ? 'nav__item nav__item--active' : 'nav__item'} onClick={() => setActiveView('tenants')}>
            Tenants
          </button>
          <button className={activeView === 'portfolio' ? 'nav__item nav__item--active' : 'nav__item'} onClick={() => setActiveView('portfolio')}>
            Portfolio
          </button>
        </nav>
        <div className="sidebar__status">
          {health?.status ? (
            <StatusPill label={health.status} tone={health.status === 'OK' ? 'ok' : 'warn'} />
          ) : (
            <StatusPill label="Unknown" tone="warn" />
          )}
          {marketSession && (
            <StatusPill label={marketSession.open ? 'MOEX open' : 'MOEX closed'} tone={marketSession.open ? 'ok' : 'warn'} />
          )}
          <div className="timestamp">
            Обновление: {lastUpdated ? lastUpdated.toLocaleTimeString('ru-RU') : '—'}
          </div>
          {token && (
            <button className="btn-secondary" onClick={handleLogout}>Выйти</button>
          )}
        </div>
      </aside>

      <main className="content">
        {activeView === 'overview' && (
          <>
            {token && metrics?.alert && (
              <section className="grid grid--wide">
                <div className="card card--wide alert-banner">
                  <div className="card__header">
                    <h2>Critical Queue Lag</h2>
                    <StatusPill label="Alert" tone="bad" />
                  </div>
                  <div className="card__body">
                    <p className="stat">Текущее значение: {formatNumber(metrics?.lag?.num_pending)} pending</p>
                    <p className="muted">Проверьте JetStream consumer и скорость исполнения.</p>
                  </div>
                </div>
              </section>
            )}
            <section className="grid grid--hero">
              <div className="card card--primary">
                <div className="card__header">
                  <h2>Состояние ядра</h2>
                  {health?.jetstream ? (
                    <StatusPill label={health.jetstream.healthy ? 'JetStream OK' : 'JetStream DOWN'} tone={health.jetstream.healthy ? 'ok' : 'bad'} />
                  ) : (
                    <StatusPill label="JetStream n/a" tone="warn" />
                  )}
                </div>
                <div className="card__body">
                  <p className="stat">{formatNumber(health?.jetstream?.rttMs)} <span>ms RTT</span></p>
                  <p className="muted">{health?.service || 'Backend service'}</p>
                  <p className="muted">Обновлено: {formatDateTime(health?.timestamp)}</p>
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <h2>Execution Loop</h2>
                  <StatusPill label={publicMetrics?.execution?.rejected ? 'Attention' : 'Stable'} tone={publicMetrics?.execution?.rejected ? 'warn' : 'ok'} />
                </div>
                <div className="card__body">
                  <div className="stat-grid">
                    <div>
                      <p className="label">Queued</p>
                      <p className="stat">{formatNumber(publicMetrics?.execution?.queued)}</p>
                    </div>
                    <div>
                      <p className="label">Accepted</p>
                      <p className="stat">{formatNumber(publicMetrics?.execution?.accepted)}</p>
                    </div>
                    <div>
                      <p className="label">Rejected</p>
                      <p className="stat">{formatNumber(publicMetrics?.execution?.rejected)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <h2>Latency Profile</h2>
                  <StatusPill label="P50 / P95 / P99" tone="ok" />
                </div>
                <div className="card__body">
                  <div className="latency">
                    <div>
                      <p className="label">P50</p>
                      <p className="stat">{formatNumber(publicMetrics?.percentiles?.p50)} ms</p>
                    </div>
                    <div>
                      <p className="label">P95</p>
                      <p className="stat">{formatNumber(publicMetrics?.percentiles?.p95)} ms</p>
                    </div>
                    <div>
                      <p className="label">P99</p>
                      <p className="stat">{formatNumber(publicMetrics?.percentiles?.p99)} ms</p>
                    </div>
                  </div>
                  <p className="muted">Окно: {publicMetrics?.percentiles?.windowMinutes ?? 60} мин</p>
                </div>
              </div>

            </section>

            <section className="grid">
              <div className="card">
                <div className="card__header">
                  <h2>Order States</h2>
                  <StatusPill label={token ? 'Private' : 'No auth'} tone={token ? 'ok' : 'warn'} />
                </div>
                <div className="card__body">
                  <div className="stack">
                    {!token && <p className="muted">Доступно после входа.</p>}
                    {token && orderStats.length === 0 && <p className="muted">Нет данных.</p>}
                    {token && orderStats.length > 0 && (
                      orderStats.map((item) => (
                        <div key={item.label} className="row">
                          <span>{item.label}</span>
                          <strong>{formatNumber(item.value)}</strong>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <h2>Queue Lag</h2>
                  <StatusPill
                    label={
                      publicMetrics?.lagTrend
                        ? publicMetrics.lagTrend.ratePerMin > 0
                          ? 'Rising'
                          : publicMetrics.lagTrend.ratePerMin < 0
                            ? 'Falling'
                            : 'Flat'
                        : publicMetrics?.lag
                          ? 'Tracked'
                          : 'No data'
                    }
                    tone={
                      publicMetrics?.lagTrend
                        ? publicMetrics.lagTrend.ratePerMin > 0
                          ? 'warn'
                          : 'ok'
                        : publicMetrics?.lag
                          ? 'ok'
                          : 'warn'
                    }
                  />
                </div>
                <div className="card__body">
                  <p className="stat">{formatNumber(publicMetrics?.lag?.num_pending)} <span>pending</span></p>
                  <p className="muted">Consumer: {publicMetrics?.consumer?.name ?? 'execution-worker'}</p>
                  {publicMetrics?.lagTrend?.points?.length ? (
                    <>
                      <Sparkline values={publicMetrics.lagTrend.points.map((point) => point.pending)} />
                      <p className="muted">Δ pending: {formatNumber(publicMetrics.lagTrend.deltaPending)} · {publicMetrics.lagTrend.ratePerMin.toFixed(2)} / мин</p>
                    </>
                  ) : (
                    <p className="muted">Нет тренда.</p>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card__header">
                  <h2>Market Pulse</h2>
                  <StatusPill label="Ticks" tone="ok" />
                </div>
                <div className="card__body">
                  <div className="stack">
                    {publicMetrics?.recentTicks?.length ? (
                      publicMetrics.recentTicks.map((tick) => (
                        <div key={`${tick.exchange}-${tick.symbol}`} className="row">
                          <span>{tick.exchange} · {tick.symbol}</span>
                          <strong>{formatDateTime(tick.last_ts)}</strong>
                        </div>
                      ))
                    ) : (
                      <p className="muted">Нет обновлений.</p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeView === 'metrics' && (
          <>
            <section className="grid grid--wide">
              <div className="card card--wide">
                <div className="card__header">
                  <h2>Execution Contour</h2>
                  <StatusPill label="HFT · Co-location" tone="ok" />
                </div>
                <div className="card__body">
                  <div className="timeline">
                    <div>
                      <p className="label">Ingress</p>
                      <p className="stat small">Market feed normalizer + throttle</p>
                    </div>
                    <div>
                      <p className="label">Decision</p>
                      <p className="stat small">Strategy engine + risk gating</p>
                    </div>
                    <div>
                      <p className="label">Execution</p>
                      <p className="stat small">Broker router + idempotency</p>
                    </div>
                    <div>
                      <p className="label">Audit</p>
                      <p className="stat small">Fills reconciliation + compliance</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid">
              {trend.map((item) => (
                <div key={item.label} className="card">
                  <div className="card__header">
                    <h2>{item.label} trend</h2>
                    <StatusPill label="Live" tone="ok" />
                  </div>
                  <div className="card__body">
                    <Sparkline values={item.values} />
                    <p className="muted">Последнее: {formatNumber(item.values[item.values.length - 1])}</p>
                  </div>
                </div>
              ))}
              <div className="card">
                <div className="card__header">
                  <h2>Lag Trend</h2>
                  <StatusPill label={metrics?.alert ? 'Critical' : 'Monitor'} tone={metrics?.alert ? 'bad' : 'ok'} />
                </div>
                <div className="card__body">
                  {metrics?.lagTrend?.points?.length ? (
                    <>
                      <Sparkline values={metrics.lagTrend.points.map((point) => point.pending)} />
                      <div className="row">
                        <span>Δ pending</span>
                        <strong>{formatNumber(metrics.lagTrend.deltaPending)}</strong>
                      </div>
                      <div className="row">
                        <span>Rate / мин</span>
                        <strong>{metrics.lagTrend.ratePerMin.toFixed(2)}</strong>
                      </div>
                    </>
                  ) : (
                    <p className="muted">Нет данных по тренду.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid--wide">
              <div className="card card--wide">
                <div className="card__header">
                  <h2>Latency Buckets</h2>
                  <StatusPill label="Executed orders" tone="ok" />
                </div>
                <div className="card__body">
                  <div className="bars">
                    {latencyBars.map((bar) => (
                      <div key={bar.label} className="bar">
                        <div className="bar__label">{bar.label}</div>
                        <div className="bar__track">
                          <div className="bar__fill" style={{ width: `${(bar.value / maxLatency) * 100}%` }} />
                        </div>
                        <div className="bar__value">{formatNumber(bar.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid grid--wide">
              <div className="card card--wide">
                <div className="card__header">
                  <h2>Queue Policy</h2>
                  <StatusPill label="Private" tone="ok" />
                </div>
                <div className="card__body">
                  <form className="tenant-form" onSubmit={(event) => { event.preventDefault(); handleSaveQueuePolicy(); }}>
                    <label>
                      Lag threshold
                      <input
                        type="number"
                        value={lagThreshold}
                        onChange={(event) => setLagThreshold(event.target.value)}
                        min="0"
                        step="1"
                      />
                    </label>
                    <label>
                      Critical threshold
                      <input
                        type="number"
                        value={lagCriticalThreshold}
                        onChange={(event) => setLagCriticalThreshold(event.target.value)}
                        min="0"
                        step="1"
                      />
                    </label>
                    <button type="submit" disabled={policySaving}>
                      {policySaving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    {policyStatus && <span className="muted">{policyStatus}</span>}
                  </form>
                </div>
              </div>
            </section>

            <section className="grid grid--wide">
              <div className="card card--wide">
                <div className="card__header">
                  <h2>Risk Policy</h2>
                  <StatusPill label="Private" tone="ok" />
                </div>
                <div className="card__body">
                  <form className="tenant-form tenant-form--compact" onSubmit={(event) => { event.preventDefault(); handleSaveRiskPolicy(); }}>
                    <label>
                      Max notional
                      <span className="hint">Лимит суммы за сделку</span>
                      <input
                        type="number"
                        value={riskMaxNotional}
                        onChange={(event) => setRiskMaxNotional(event.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </label>
                    <label>
                      Max daily notional
                      <span className="hint">Лимит суммы в день</span>
                      <input
                        type="number"
                        value={riskMaxDailyNotional}
                        onChange={(event) => setRiskMaxDailyNotional(event.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </label>
                    <label>
                      Max open notional
                      <span className="hint">Открытая сумма</span>
                      <input
                        type="number"
                        value={riskMaxOpenNotional}
                        onChange={(event) => setRiskMaxOpenNotional(event.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </label>
                    <label>
                      Max qty per order
                      <span className="hint">Кол-во в одном ордере</span>
                      <input
                        type="number"
                        value={riskMaxQtyPerOrder}
                        onChange={(event) => setRiskMaxQtyPerOrder(event.target.value)}
                        min="0"
                        step="1"
                      />
                    </label>
                    <label>
                      Max open orders
                      <span className="hint">Открытых ордеров всего</span>
                      <input
                        type="number"
                        value={riskMaxOpenOrders}
                        onChange={(event) => setRiskMaxOpenOrders(event.target.value)}
                        min="0"
                        step="1"
                      />
                    </label>
                    <label>
                      Max daily orders
                      <span className="hint">Ордеров в сутки</span>
                      <input
                        type="number"
                        value={riskMaxDailyOrders}
                        onChange={(event) => setRiskMaxDailyOrders(event.target.value)}
                        min="0"
                        step="1"
                      />
                    </label>
                    <label>
                      Max open qty per symbol
                      <span className="hint">Открыто по тикеру</span>
                      <input
                        type="number"
                        value={riskMaxOpenQtyPerSymbol}
                        onChange={(event) => setRiskMaxOpenQtyPerSymbol(event.target.value)}
                        min="0"
                        step="1"
                      />
                    </label>
                    <label>
                      Max open notional per symbol
                      <span className="hint">Сумма по тикеру</span>
                      <input
                        type="number"
                        value={riskMaxOpenNotionalPerSymbol}
                        onChange={(event) => setRiskMaxOpenNotionalPerSymbol(event.target.value)}
                        min="0"
                        step="0.01"
                      />
                    </label>
                    <label>
                      Max position qty per symbol
                      <span className="hint">Позиция по тикеру (fills)</span>
                      <input
                        type="number"
                        value={riskMaxPositionQtyPerSymbol}
                        onChange={(event) => setRiskMaxPositionQtyPerSymbol(event.target.value)}
                        min="0"
                        step="1"
                      />
                    </label>
                    <button type="submit" disabled={riskPolicySaving}>
                      {riskPolicySaving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                    {riskPolicyStatus && <span className="muted">{riskPolicyStatus}</span>}
                  </form>
                </div>
              </div>
            </section>

            <section className="grid grid--wide">
              <div className="card card--wide">
                <div className="card__header">
                  <h2>Execution Errors</h2>
                  <StatusPill label="Recent" tone="warn" />
                </div>
                <div className="card__body">
                  <div className="analytics-grid">
                    <div>
                      <p className="label">Routed rejections</p>
                      <div className="stack">
                        {metrics?.errors?.routedRejections?.length ? (
                          metrics.errors.routedRejections.map((item, index) => (
                            <div key={`rej-${index}`} className="row">
                              <span>{item.message}</span>
                              <strong>{formatNumber(item.count)}</strong>
                            </div>
                          ))
                        ) : (
                          <p className="muted">Нет данных.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="label">Last errors</p>
                      <div className="stack">
                        {metrics?.errors?.lastErrors?.length ? (
                          metrics.errors.lastErrors.map((item, index) => (
                            <div key={`last-${index}`} className="row">
                              <span>{item.last_error}</span>
                              <strong>{formatNumber(item.count)}</strong>
                            </div>
                          ))
                        ) : (
                          <p className="muted">Нет данных.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeView === 'analytics' && (
          <section className="grid grid--wide">
            <div className="card card--wide">
              <div className="card__header">
                <h2>Analytics Snapshots</h2>
                <StatusPill label="Private" tone="ok" />
              </div>
              <div className="card__body">
                <div className="instrument-toolbar">
                  <input
                    type="number"
                    min="1"
                    value={analyticsWindow}
                    onChange={(event) => setAnalyticsWindow(event.target.value)}
                  />
                  <button type="button" onClick={handleGenerateSnapshot} disabled={analyticsLoading}>
                    {analyticsLoading ? 'Сбор…' : 'Generate snapshot'}
                  </button>
                  {analyticsStatus && <span className="muted">{analyticsStatus}</span>}
                </div>
                <div className="events">
                  {analyticsSnapshots.length === 0 && <p className="muted">Снимков нет.</p>}
                  {analyticsSnapshots.map((snap) => (
                    <div key={snap.id} className="event">
                      <div className="event__header">
                        <strong>Window: {snap.window_minutes} мин</strong>
                        <span>{formatDateTime(snap.created_at)}</span>
                      </div>
                      <div className="analytics-grid">
                        <div>
                          <p className="label">Avg order price</p>
                          <p className="stat">{formatNumber(snap.payload?.avgOrderPrice)}</p>
                        </div>
                        <div>
                          <p className="label">Fills qty</p>
                          <p className="stat">{formatNumber(snap.payload?.fills?.totalQty)}</p>
                        </div>
                        <div>
                          <p className="label">Fills notional</p>
                          <p className="stat">{formatNumber(snap.payload?.fills?.totalNotional)}</p>
                        </div>
                        <div>
                          <p className="label">Fills avg price</p>
                          <p className="stat">{formatNumber(snap.payload?.fills?.avgPrice)}</p>
                        </div>
                      </div>
                      <div className="analytics-section">
                        <p className="label">Orders</p>
                        <div className="stack">
                          {snap.payload?.orders?.length ? (
                            snap.payload.orders.map((item) => (
                              <div key={`${snap.id}-${item.status}`} className="row">
                                <span>{item.status}</span>
                                <strong>{formatNumber(item.count)}</strong>
                              </div>
                            ))
                          ) : (
                            <p className="muted">Нет данных.</p>
                          )}
                        </div>
                      </div>
                      <div className="analytics-section">
                        <p className="label">Top rejections</p>
                        <div className="stack">
                          {snap.payload?.rejections?.length ? (
                            snap.payload.rejections.map((item, index) => (
                              <div key={`${snap.id}-rej-${index}`} className="row">
                                <span>{item.message}</span>
                                <strong>{formatNumber(item.count)}</strong>
                              </div>
                            ))
                          ) : (
                            <p className="muted">Нет отказов.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="divider" />
                <h3>AI Insights</h3>
                <div className="instrument-toolbar">
                  <button type="button" onClick={handleGenerateAIInsight} disabled={aiLoading}>
                    {aiLoading ? 'Генерация…' : 'Generate AI insight'}
                  </button>
                  {aiStatus && <span className="muted">{aiStatus}</span>}
                </div>
                <div className="events">
                  {aiInsights.length === 0 && <p className="muted">Инсайтов нет.</p>}
                  {aiInsights.map((insight) => (
                    <div key={insight.id} className="event">
                      <div className="event__header">
                        <strong>{insight.model || 'AI insight'}</strong>
                        <span>{formatDateTime(insight.created_at)}</span>
                      </div>
                      {insight.payload?.status === 'ok' || insight.payload?.status === 'insufficient_data' ? (
                        <div className="analytics-section">
                          <p className="label">Summary</p>
                          <p className="muted">{insight.payload.summary || '—'}</p>
                          <div className="analytics-grid">
                            <div>
                              <p className="label">Status</p>
                              <p className="stat">{insight.payload.status}</p>
                            </div>
                            <div>
                              <p className="label">Confidence</p>
                              <p className="stat">{insight.payload.confidence ?? '—'}</p>
                            </div>
                          </div>
                          <div className="analytics-section">
                            <p className="label">Insights</p>
                            <div className="stack">
                              {(insight.payload.insights || []).length ? (
                                insight.payload.insights.map((item: string, index: number) => (
                                  <div key={`${insight.id}-ins-${index}`} className="row">
                                    <span>{item}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="muted">Нет инсайтов.</p>
                              )}
                            </div>
                          </div>
                          <div className="analytics-section">
                            <p className="label">Risks</p>
                            <div className="stack">
                              {(insight.payload.risks || []).length ? (
                                insight.payload.risks.map((item: string, index: number) => (
                                  <div key={`${insight.id}-risk-${index}`} className="row">
                                    <span>{item}</span>
                                  </div>
                                ))
                              ) : (
                                <p className="muted">Нет рисков.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="analytics-section">
                          <p className="label">AI response invalid</p>
                          <p className="muted">
                            Модель вернула некорректный JSON. Нажмите Generate AI insight, чтобы повторить.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeView === 'instruments' && (
          <section className="grid grid--wide">
            <div className="card card--wide">
              <div className="card__header">
                <h2>Instruments</h2>
                <StatusPill label="MOEX" tone="ok" />
              </div>
              <div className="card__body">
                <div className="instrument-toolbar">
                  <input
                    type="text"
                    placeholder="Поиск по тикеру или названию"
                    value={instrumentQuery}
                    onChange={(event) => setInstrumentQuery(event.target.value)}
                  />
                  <span className="muted">Всего: {instruments.length}</span>
                </div>
                <div className="instrument-table">
                  <div className="instrument-row instrument-row--head">
                    <span>Тикер</span>
                    <span>Название</span>
                    <span>Валюта</span>
                    <span>Лот</span>
                    <span>InstrumentId</span>
                  </div>
                  {instruments
                    .filter((item) => {
                      const q = instrumentQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        item.symbol.toLowerCase().includes(q) ||
                        (item.name || '').toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 200)
                    .map((item) => (
                      <div
                        key={item.id}
                        className={`instrument-row ${forbiddenSymbols.has(item.symbol.toUpperCase()) ? 'instrument-row--forbidden' : ''}`}
                      >
                        <span>{item.symbol}</span>
                        <span>{item.name || '—'}</span>
                        <span>{item.currency}</span>
                        <span>{item.lot_size}</span>
                        <span>{item.instrument_id || '—'}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activeView === 'orders' && (
          <section className="grid grid--wide">
            <div className="card card--wide">
              <div className="card__header">
                <h2>Order Timeline</h2>
                <StatusPill label={token ? 'Private' : 'Login required'} tone={token ? 'ok' : 'warn'} />
              </div>
              <div className="card__body">
                <div className="broker-select">
                  <label>
                    Брокерский аккаунт
                    <select
                      value={selectedBrokerAccountId}
                      onChange={(event) => setSelectedBrokerAccountId(event.target.value)}
                    >
                      {brokerAccounts.length === 0 && <option value="">Нет аккаунтов</option>}
                      {brokerAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.broker} · {account.account_number} · {account.environment}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="order-layout">
                  <div className="order-form">
                    <h3>Новый ордер</h3>
                    <form className="tenant-form" onSubmit={handleCreateOrder}>
                      <label>
                        Symbol
                        <input
                          type="text"
                          value={orderSymbol}
                          onChange={(event) => setOrderSymbol(event.target.value)}
                          placeholder="SBER"
                          required
                        />
                      </label>
                      <label>
                        Side
                        <select value={orderSide} onChange={(event) => setOrderSide(event.target.value as 'buy' | 'sell')}>
                          <option value="buy">Buy</option>
                          <option value="sell">Sell</option>
                        </select>
                      </label>
                      <label>
                        Type
                        <select value={orderType} onChange={(event) => setOrderType(event.target.value as 'market' | 'limit')}>
                          <option value="limit">Limit</option>
                          <option value="market">Market</option>
                        </select>
                      </label>
                      <label>
                        Quantity
                        <input
                          type="number"
                          value={orderQuantity}
                          onChange={(event) => setOrderQuantity(event.target.value)}
                          min="0"
                          step="1"
                          required
                        />
                      </label>
                      {orderType === 'limit' && (
                        <label>
                          Price
                          <input
                            type="number"
                            value={orderPrice}
                            onChange={(event) => setOrderPrice(event.target.value)}
                            min="0"
                            step="0.01"
                            required
                          />
                        </label>
                      )}
                      <div className="sync-actions">
                        <button type="submit" disabled={orderSubmitting || (marketSession && !marketSession.open)}>
                          {orderSubmitting ? 'Отправка…' : 'Создать ордер'}
                        </button>
                        <button type="button" className="btn-secondary" onClick={handleValidateInstrument}>
                          Validate instrument
                        </button>
                        <button type="button" className="btn-secondary" onClick={handleTradingStatus}>
                          Trading status
                        </button>
                      </div>
                      {marketSession && !marketSession.open && (
                        <span className="muted">
                          MOEX закрыта ({marketSession.window.open}–{marketSession.window.close} MSK). Ордеры могут быть отклонены.
                        </span>
                      )}
                      {instrumentStatus && <span className="muted">{instrumentStatus}</span>}
                      {tradingStatus && <span className="muted">{tradingStatus}</span>}
                    </form>
                  </div>
                  <div className="order-list">
                    {orders.length === 0 && <p className="muted">Нет ордеров.</p>}
                    {orders.slice(0, 20).map((order) => (
                      <button
                        key={order.id}
                        className={`order-item ${selectedOrder?.id === order.id ? 'order-item--active' : ''} ${order.status === 'rejected' && forbiddenSymbols.has(order.symbol.toUpperCase()) ? 'order-item--forbidden' : ''}`}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div>
                          <strong>{order.symbol}</strong> · {order.side} · {order.order_type}
                        </div>
                        <div className="muted">{formatDateTime(order.created_at)}</div>
                        <div className="muted">Status: {order.status}</div>
                      </button>
                    ))}
                  </div>
                  <div className="order-events">
                      <h3>События</h3>
                      {selectedOrder && (
                        <p className="muted">
                          Ордер {selectedOrder.symbol} · {selectedOrder.quantity} @ {selectedOrder.price ?? 'MKT'}
                        </p>
                      )}
                      <form className="tenant-form" onSubmit={handleSimulateWebhook}>
                        <label>
                          Broker
                          <select value={simulateBroker} onChange={(event) => setSimulateBroker(event.target.value as 'tinkoff' | 'sber')}>
                            <option value="tinkoff">tinkoff</option>
                            <option value="sber">sber</option>
                          </select>
                        </label>
                        <label>
                          Status
                          <select value={simulateStatus} onChange={(event) => setSimulateStatus(event.target.value)}>
                            <option value="accepted">accepted</option>
                            <option value="filled">filled</option>
                            <option value="partially_filled">partially_filled</option>
                            <option value="rejected">rejected</option>
                            <option value="cancelled">cancelled</option>
                          </select>
                        </label>
                        <label>
                          Filled qty
                          <input
                            type="number"
                            value={simulateFilledQty}
                            onChange={(event) => setSimulateFilledQty(event.target.value)}
                            min="0"
                            step="1"
                          />
                        </label>
                        <label>
                          Price
                          <input
                            type="number"
                            value={simulatePrice}
                            onChange={(event) => setSimulatePrice(event.target.value)}
                            min="0"
                            step="0.01"
                          />
                        </label>
                        <label>
                          Trade id
                          <input
                            type="text"
                            value={simulateTradeId}
                            onChange={(event) => setSimulateTradeId(event.target.value)}
                            placeholder="sim-001"
                          />
                        </label>
                        <button type="submit" disabled={!selectedOrder || simulateSubmitting}>
                          {simulateSubmitting ? 'Симуляция…' : 'Simulate webhook'}
                        </button>
                        {simulateStatusText && <span className="muted">{simulateStatusText}</span>}
                      </form>
                      {orderEvents.length === 0 && <p className="muted">Нет событий.</p>}
                      {orderEvents.length > 0 && (
                        <div className="events">
                          {orderEvents.map((event) => (
                            <div key={event.id} className="event">
                              <div className="event__header">
                                <strong>{event.event_type}</strong>
                                <span>{formatDateTime(event.created_at)}</span>
                              </div>
                              {resolveErrorMessage(event.payload, tinkoffErrorMap) && (
                                <p className="muted">Broker: {String(resolveErrorMessage(event.payload, tinkoffErrorMap))}</p>
                              )}
                              <pre>{JSON.stringify(event.payload, null, 2)}</pre>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeView === 'tenants' && (
          <section className="grid grid--wide">
            <div className="card card--wide">
              <div className="card__header">
                <h2>Tenants</h2>
                <StatusPill label={token ? 'Private' : 'Login required'} tone={token ? 'ok' : 'warn'} />
              </div>
              <div className="card__body">
                {token && (
                  <>
                    <form className="tenant-form" onSubmit={handleCreateTenant}>
                      <label>
                        Название
                        <input
                          type="text"
                          value={tenantName}
                          onChange={(event) => setTenantName(event.target.value)}
                          placeholder="Alpha Desk"
                          required
                        />
                      </label>
                      <label>
                        Slug
                        <input
                          type="text"
                          value={tenantSlug}
                          onChange={(event) => setTenantSlug(event.target.value)}
                          placeholder="alpha-desk"
                          required
                        />
                      </label>
                      <button type="submit">Создать tenant</button>
                    </form>
                    <div className="stack">
                      {tenants.length === 0 && <p className="muted">Нет tenants.</p>}
                      {tenants.map((tenant) => (
                        <div key={tenant.id} className="row">
                          <span>{tenant.name} · {tenant.slug}</span>
                          <strong>{tenant.status} {tenant.role ? `· ${tenant.role}` : ''}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="divider" />
                    <h3>Broker Accounts</h3>
                    <form className="tenant-form" onSubmit={handleSandboxSetup}>
                      <label>
                        Sandbox account name
                        <input
                          type="text"
                          value={sandboxName}
                          onChange={(event) => setSandboxName(event.target.value)}
                          placeholder="Sandbox main"
                        />
                      </label>
                      <label>
                        Initial balance
                        <input
                          type="number"
                          value={sandboxAmount}
                          onChange={(event) => setSandboxAmount(event.target.value)}
                          placeholder="100000"
                        />
                      </label>
                      <label>
                        Currency
                        <input
                          type="text"
                          value={sandboxCurrency}
                          onChange={(event) => setSandboxCurrency(event.target.value)}
                          placeholder="RUB"
                        />
                      </label>
                      <button type="submit">Setup Tinkoff Sandbox</button>
                    </form>
                    <div className="broker-select">
                      <label>
                        Аккаунт для синка инструментов
                        <select
                          value={syncBrokerAccountId}
                          onChange={(event) => setSyncBrokerAccountId(event.target.value)}
                        >
                          {brokerAccounts.length === 0 && <option value="">Нет аккаунтов</option>}
                          {brokerAccounts.map((account) => (
                            <option key={account.id} value={account.id}>
                              {account.broker} · {account.account_number} · {account.environment}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="sync-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={!syncBrokerAccountId || syncSubmitting}
                          onClick={() => handleSyncInstruments('basic')}
                        >
                          {syncSubmitting ? 'Синхронизация…' : 'Sync Instruments'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={!syncBrokerAccountId || syncSubmitting}
                          onClick={() => handleSyncInstruments('full')}
                        >
                          {syncSubmitting ? 'Синхронизация…' : 'Full Sync (Tinkoff)'}
                        </button>
                      </div>
                      {syncStatus && <span className="muted">{syncStatus}</span>}
                    </div>
                    <div className="stack">
                      {brokerAccounts.length === 0 && <p className="muted">Нет broker accounts.</p>}
                      {brokerAccounts.map((account) => (
                        <div key={account.id} className="row">
                          <span>{account.broker} · {account.account_number}</span>
                          <strong>{account.environment} · {account.currency}</strong>
                        </div>
                      ))}
                    </div>
                    <div className="divider" />
                    <h3>Tinkoff Error Map</h3>
                    <div className="instrument-toolbar">
                      <button type="button" className="btn-secondary" onClick={handleSeedTinkoffErrors} disabled={tinkoffErrorSeeding}>
                        {tinkoffErrorSeeding ? 'Сидирование…' : 'Seed from file'}
                      </button>
                      <button type="button" className="btn-secondary" onClick={handleBackfillTinkoffErrors} disabled={tinkoffErrorSeeding}>
                        {tinkoffErrorSeeding ? 'Backfill…' : 'Backfill errors'}
                      </button>
                      {tinkoffErrorStatus && <span className="muted">{tinkoffErrorStatus}</span>}
                    </div>
                    <form className="tenant-form" onSubmit={handleSaveTinkoffError}>
                      <label>
                        Код ошибки
                        <input
                          type="text"
                          value={tinkoffErrorCode}
                          onChange={(event) => setTinkoffErrorCode(event.target.value)}
                          placeholder="5"
                          required
                        />
                      </label>
                      <label>
                        Сообщение
                        <input
                          type="text"
                          value={tinkoffErrorMessage}
                          onChange={(event) => setTinkoffErrorMessage(event.target.value)}
                          placeholder="Trading status unavailable in sandbox"
                          required
                        />
                      </label>
                      <button type="submit" disabled={tinkoffErrorSaving}>
                        {tinkoffErrorSaving ? 'Сохранение…' : 'Сохранить'}
                      </button>
                    </form>
                    <div className="stack">
                      {Object.keys(tinkoffErrorMap).length === 0 && <p className="muted">Маппинг пуст.</p>}
                      {Object.entries(tinkoffErrorMap).map(([code, message]) => (
                        <div key={code} className="row">
                          <span>{code}</span>
                          <strong>{message}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {activeView === 'portfolio' && (
          <section className="grid grid--wide">
            <div className="card card--wide">
              <div className="card__header">
                <h2>Trades & Portfolio</h2>
                <StatusPill label="Read-only" tone="ok" />
              </div>
              <div className="card__body">
                <div className="instrument-toolbar">
                  <button type="button" className="btn-secondary" onClick={handleSyncPortfolioTicks} disabled={portfolioSyncing}>
                    {portfolioSyncing ? 'Syncing…' : 'Sync last ticks'}
                  </button>
                  {portfolioStatus && <span className="muted">{portfolioStatus}</span>}
                </div>
                {portfolioPositions.length === 0 ? (
                  <p className="muted">Позиции пока пусты (нужны fills).</p>
                ) : (
                  <div className="instrument-table">
                    <div className="instrument-row instrument-row--head">
                      <span>Symbol</span>
                      <span>Net qty</span>
                      <span>Avg price</span>
                      <span>Last price</span>
                      <span>Unrealized</span>
                    </div>
                    {portfolioPositions.map((pos) => (
                      <div key={`${pos.symbol}-${pos.broker_account_id || 'na'}`} className="instrument-row">
                        <span>{pos.symbol}</span>
                        <span>{formatNumber(pos.net_qty)}</span>
                        <span>{formatNumber(pos.avg_price)}</span>
                        <span>{formatNumber(pos.last_price ?? null)}</span>
                        <span>{formatNumber(pos.unrealized_pnl ?? null)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {error && (
        <div className="toast">
          <strong>Ошибка:</strong> {error}
        </div>
      )}
    </div>
  );
}
type AnalyticsSnapshot = {
  id: string;
  window_minutes: number;
  payload: {
    windowMinutes: number;
    orders: Array<{ status: string; count: number }>;
    fills: { totalQty: number; totalNotional: number; avgPrice: number };
    avgOrderPrice: number;
    rejections: Array<{ message: string; count: number }>;
  };
  created_at: string;
};

type AIInsight = {
  id: string;
  snapshot_id?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  payload: any;
  created_at: string;
};
