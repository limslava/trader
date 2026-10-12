import crypto from 'node:crypto';
import { pool } from './db.js';
import { HttpError, KeyedLock, TtlCache } from './http.js';
import { call, isSandbox, q, tinkoffConfigured } from './tinkoff.js';

/**
 * Paper trading in the T-Invest sandbox. Uses the regular Users/Operations/Orders methods against the sandbox host
 * (the approach the T-Invest docs recommend); only account opening and top-ups are sandbox-specific.
 * Real trading is deliberately not wired up: every entry point refuses unless TINKOFF_SANDBOX=true.
 */

type Quotation = { units?: string; nano?: number };
type Money = Quotation & { currency?: string };

const COMMISSION = 0.0005; // sandbox charges 0.05% of the trade value

export function assertSandbox() {
  if (!tinkoffConfigured()) throw new HttpError(503, 'T-Invest не настроен: задайте TINKOFF_TOKEN в .env');
  if (!isSandbox) throw new HttpError(403, 'Торговля доступна только в песочнице (TINKOFF_SANDBOX=true)');
}

function toQuotation(v: number): Quotation {
  const units = Math.trunc(v);
  return { units: String(units), nano: Math.round((v - units) * 1e9) };
}

// --- Instruments ---

type TradableInstrument = {
  uid: string;
  ticker: string;
  name: string;
  lot: number;
  minPriceIncrement: number;
  buyAvailableFlag: boolean;
  sellAvailableFlag: boolean;
  apiTradeAvailableFlag: boolean;
};

type RawInstrument = Omit<TradableInstrument, 'minPriceIncrement'> & { minPriceIncrement?: Quotation };

const byTicker = new TtlCache<TradableInstrument>(24 * 60 * 60_000);
const byUid = new TtlCache<TradableInstrument>(24 * 60 * 60_000);

const normalize = (i: RawInstrument): TradableInstrument => ({ ...i, minPriceIncrement: q(i.minPriceIncrement) ?? 0.01 });

export function instrumentByTicker(secid: string) {
  return byTicker.get(secid, async () => {
    const { instrument } = await call<{ instrument: RawInstrument }>('InstrumentsService/GetInstrumentBy', {
      idType: 'INSTRUMENT_ID_TYPE_TICKER',
      classCode: 'TQBR',
      id: secid,
    });
    return normalize(instrument);
  });
}

function instrumentByUid(uid: string) {
  return byUid.get(uid, async () => {
    const { instrument } = await call<{ instrument: RawInstrument }>('InstrumentsService/GetInstrumentBy', {
      idType: 'INSTRUMENT_ID_TYPE_UID',
      id: uid,
    });
    return normalize(instrument);
  });
}

export async function tradingStatus(secid: string) {
  const inst = await instrumentByTicker(secid);
  const [status, prices] = await Promise.all([
    call<{ tradingStatus: string; limitOrderAvailableFlag: boolean; marketOrderAvailableFlag: boolean }>(
      'MarketDataService/GetTradingStatus',
      { instrumentId: inst.uid },
    ),
    call<{ lastPrices: { price?: Quotation; time?: string }[] }>('MarketDataService/GetLastPrices', {
      instrumentId: [inst.uid],
    }),
  ]);
  return {
    secid,
    name: inst.name,
    lot: inst.lot,
    minPriceIncrement: inst.minPriceIncrement,
    lastPrice: q(prices.lastPrices[0]?.price),
    lastPriceTime: prices.lastPrices[0]?.time ?? null,
    canTrade: inst.apiTradeAvailableFlag && (status.limitOrderAvailableFlag || status.marketOrderAvailableFlag),
    marketOrderAvailable: status.marketOrderAvailableFlag,
    limitOrderAvailable: status.limitOrderAvailableFlag,
    status: status.tradingStatus,
  };
}

// --- Account ---

type Account = { id: string; name: string; status: string };

async function findAccount(): Promise<Account | null> {
  const { accounts = [] } = await call<{ accounts?: Account[] }>('UsersService/GetAccounts', {});
  return accounts.find((a) => a.status === 'ACCOUNT_STATUS_OPEN') ?? null;
}

// The account id does not change while the process runs; avoid a broker round-trip on every call.
let cachedAccount: Account | null = null;

export async function requireAccount(): Promise<Account> {
  if (cachedAccount) return cachedAccount;
  const account = await findAccount();
  if (!account) throw new HttpError(409, 'Счёт песочницы не открыт');
  cachedAccount = account;
  return account;
}

const MAX_PAYIN = 30_000_000; // sandbox top-up limit

export async function openAccount(amount: number) {
  if ((await findAccount()) !== null) throw new HttpError(409, 'Счёт песочницы уже открыт');
  const { accountId } = await call<{ accountId: string }>('SandboxService/OpenSandboxAccount', { name: 'Trader' });
  await payIn(accountId, amount);
  return accountId;
}

export async function payIn(accountId: string, amount: number) {
  if (!(amount > 0 && amount <= MAX_PAYIN)) throw new HttpError(422, `Сумма пополнения: от 1 до ${MAX_PAYIN} ₽`);
  await call('SandboxService/SandboxPayIn', { accountId, amount: { currency: 'rub', ...toQuotation(amount) } });
}

export async function closeAccount() {
  const account = await requireAccount();
  await call('SandboxService/CloseSandboxAccount', { accountId: account.id });
  cachedAccount = null;
}

// --- Portfolio ---

type RawPosition = {
  instrumentType: string;
  instrumentUid: string;
  ticker?: string;
  quantity?: Quotation;
  quantityLots?: Quotation;
  blockedLots?: Quotation;
  averagePositionPrice?: Money;
  currentPrice?: Money;
  expectedYield?: Quotation;
};

export async function portfolio() {
  const account = await requireAccount();
  const [p, positions] = await Promise.all([
    call<{
      totalAmountPortfolio?: Money;
      totalAmountCurrencies?: Money;
      expectedYield?: Quotation;
      positions?: RawPosition[];
    }>('OperationsService/GetPortfolio', { accountId: account.id, currency: 'RUB' }),
    call<{ money?: Money[]; blocked?: Money[] }>('OperationsService/GetPositions', { accountId: account.id }),
  ]);
  const rub = (list?: Money[]) => q(list?.find((m) => m.currency === 'rub')) ?? 0;
  // `money` is already net of funds blocked by active orders.
  const freeCash = rub(positions.money);
  const blockedCash = rub(positions.blocked);

  const securities = await Promise.all(
    (p.positions ?? [])
      .filter((pos) => pos.instrumentType !== 'currency')
      .map(async (pos) => {
        const inst = await instrumentByUid(pos.instrumentUid).catch(() => null);
        const quantity = q(pos.quantity) ?? 0;
        const currentPrice = q(pos.currentPrice);
        const avg = q(pos.averagePositionPrice);
        const value = currentPrice !== null ? currentPrice * quantity : null;
        return {
          secid: pos.ticker ?? inst?.ticker ?? pos.instrumentUid,
          name: inst?.name ?? '',
          quantity,
          lots: q(pos.quantityLots) ?? 0,
          blockedLots: q(pos.blockedLots) ?? 0,
          // The sandbox does not compute average prices yet; 0 means "unknown".
          averagePrice: avg || null,
          currentPrice,
          value,
          // Profit vs. average purchase price; unknown when the sandbox has no average yet.
          expectedYield: avg && value !== null ? value - avg * quantity : null,
        };
      }),
  );

  return {
    accountId: account.id,
    total: q(p.totalAmountPortfolio),
    cash: freeCash + blockedCash,
    blockedCash,
    availableCash: freeCash,
    positions: securities.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
  };
}

// --- Orders ---

export type OrderInput = {
  secid: string;
  direction: 'buy' | 'sell';
  lots: number;
  type: 'market' | 'limit';
  price?: number;
};

type OrderState = {
  orderId: string;
  executionReportStatus: string;
  lotsRequested?: string;
  lotsExecuted?: string;
  initialOrderPrice?: Money;
  executedOrderPrice?: Money;
  totalOrderAmount?: Money;
  initialSecurityPrice?: Money;
  executedCommission?: Money;
  direction: string;
  orderType: string;
  orderDate?: string;
  instrumentUid: string;
  ticker?: string;
  message?: string;
};

const STATUS_RU: Record<string, string> = {
  EXECUTION_REPORT_STATUS_FILL: 'Исполнена',
  EXECUTION_REPORT_STATUS_REJECTED: 'Отклонена',
  EXECUTION_REPORT_STATUS_CANCELLED: 'Отменена',
  EXECUTION_REPORT_STATUS_NEW: 'Ждёт исполнения',
  EXECUTION_REPORT_STATUS_PARTIALLYFILL: 'Исполнена частично',
};

function orderDto(o: OrderState, ticker?: string) {
  return {
    orderId: o.orderId,
    secid: o.ticker ?? ticker ?? o.instrumentUid,
    status: o.executionReportStatus,
    statusText: STATUS_RU[o.executionReportStatus] ?? o.executionReportStatus,
    direction: o.direction === 'ORDER_DIRECTION_BUY' ? 'buy' : 'sell',
    type: o.orderType === 'ORDER_TYPE_LIMIT' ? 'limit' : 'market',
    lotsRequested: Number(o.lotsRequested ?? 0),
    lotsExecuted: Number(o.lotsExecuted ?? 0),
    price: q(o.initialSecurityPrice),
    executedAmount: q(o.executedOrderPrice),
    totalAmount: q(o.totalOrderAmount),
    commission: q(o.executedCommission),
    createdAt: o.orderDate ?? null,
    message: o.message || null,
  };
}

/**
 * Validates against what the user actually owns: no buying beyond available cash (the sandbox would allow 2x
 * leverage) and no selling more than held (no shorts). Beginners should not trade on margin by accident.
 */
const orderLock = new KeyedLock();

/** Orders are serialized so two concurrent buys cannot both pass the cash check (TOCTOU). */
export function placeOrder(input: OrderInput) {
  return orderLock.run('orders', () => placeOrderUnlocked(input));
}

async function placeOrderUnlocked(input: OrderInput) {
  const account = await requireAccount();
  const [inst, status, pf] = await Promise.all([
    instrumentByTicker(input.secid),
    tradingStatus(input.secid),
    portfolio(),
  ]);

  if (!status.canTrade) throw new HttpError(422, 'Торги по бумаге сейчас закрыты — заявку можно будет выставить в торговую сессию');
  if (input.type === 'market' && !status.marketOrderAvailable) throw new HttpError(422, 'Рыночные заявки сейчас недоступны — используйте лимитную');
  if (input.type === 'limit' && !status.limitOrderAvailable) throw new HttpError(422, 'Лимитные заявки сейчас недоступны');
  if (input.direction === 'buy' ? !inst.buyAvailableFlag : !inst.sellAvailableFlag) {
    throw new HttpError(422, 'Бумага сейчас недоступна для этой операции');
  }

  let price: number | undefined;
  if (input.type === 'limit') {
    if (!input.price || input.price <= 0) throw new HttpError(422, 'Укажите цену для лимитной заявки');
    // Prices must be a multiple of the instrument's tick size.
    const step = inst.minPriceIncrement;
    price = Number((Math.round(input.price / step) * step).toFixed(9));
  }

  const unitPrice = price ?? status.lastPrice;
  if (!unitPrice) throw new HttpError(422, 'Нет текущей цены для расчёта заявки');
  const amount = input.lots * inst.lot * unitPrice;

  if (input.direction === 'buy') {
    const needed = amount * (1 + COMMISSION);
    if (needed > pf.availableCash) {
      throw new HttpError(
        422,
        `Недостаточно денег: нужно ≈${needed.toFixed(2)} ₽, доступно ${pf.availableCash.toFixed(2)} ₽. Покупка в долг отключена.`,
      );
    }
  } else {
    const held = pf.positions.find((p) => p.secid === input.secid);
    const free = (held?.lots ?? 0) - (held?.blockedLots ?? 0);
    if (input.lots > free) throw new HttpError(422, `Можно продать не больше ${free} лот(ов) — продажа без бумаг (шорт) отключена`);
  }

  const requestId = crypto.randomUUID();
  const body = {
    instrumentId: inst.uid,
    quantity: String(input.lots),
    direction: input.direction === 'buy' ? 'ORDER_DIRECTION_BUY' : 'ORDER_DIRECTION_SELL',
    accountId: account.id,
    orderType: input.type === 'limit' ? 'ORDER_TYPE_LIMIT' : 'ORDER_TYPE_MARKET',
    orderId: requestId, // idempotency key
    ...(price !== undefined ? { price: toQuotation(price) } : {}),
  };
  // Record intent BEFORE talking to the broker: if the call times out after the broker accepted it,
  // the log still shows a pending order instead of silently losing it.
  await pool.query(
    `INSERT INTO trade_log (request_id, account_id, secid, direction, order_type, lots, price, status, response)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', '{}')`,
    [requestId, account.id, input.secid, input.direction, input.type, input.lots, price ?? null],
  );

  let res: OrderState;
  try {
    res = await call<OrderState>('OrdersService/PostOrder', body);
  } catch (err) {
    // Timeout or network error: the broker may still have the order. Try to find it by our idempotency key.
    const found = await reconcile(account.id, requestId).catch(() => null);
    if (!found) {
      await pool.query(`UPDATE trade_log SET status = 'FAILED', response = $2 WHERE request_id = $1`, [
        requestId,
        { error: err instanceof Error ? err.message : String(err) },
      ]);
      throw err;
    }
    res = found;
  }

  const dto = orderDto(res, input.secid);
  await pool.query(`UPDATE trade_log SET order_id = $2, status = $3, response = $4 WHERE request_id = $1`, [
    requestId,
    dto.orderId,
    dto.status,
    res,
  ]);
  return dto;
}

/** Looks the order up by the client-side idempotency key among active orders and recent operations. */
async function reconcile(accountId: string, requestId: string): Promise<OrderState | null> {
  const { orders = [] } = await call<{ orders?: (OrderState & { orderRequestId?: string })[] }>('OrdersService/GetOrders', {
    accountId,
  });
  return orders.find((o) => o.orderRequestId === requestId) ?? null;
}

export async function activeOrders() {
  const account = await requireAccount();
  const { orders = [] } = await call<{ orders?: OrderState[] }>('OrdersService/GetOrders', { accountId: account.id });
  return Promise.all(
    orders.map(async (o) => orderDto(o, o.ticker ?? (await instrumentByUid(o.instrumentUid).catch(() => null))?.ticker)),
  );
}

export async function cancelOrder(orderId: string) {
  const account = await requireAccount();
  await call('OrdersService/CancelOrder', { accountId: account.id, orderId });
}

type RawOperation = {
  id: string;
  date: string;
  type: string;
  operationType: string;
  state: string;
  payment?: Money;
  price?: Money;
  quantity?: string;
  instrumentUid?: string;
};

export async function operations(days = 90) {
  const account = await requireAccount();
  const now = Date.now();
  const { operations: ops = [] } = await call<{ operations?: RawOperation[] }>('OperationsService/GetOperations', {
    accountId: account.id,
    from: new Date(now - days * 86_400_000).toISOString(),
    to: new Date(now + 60_000).toISOString(),
    state: 'OPERATION_STATE_EXECUTED',
  });
  return Promise.all(
    ops.map(async (o) => ({
      id: o.id,
      date: o.date,
      title: o.type,
      operationType: o.operationType,
      secid: o.instrumentUid ? ((await instrumentByUid(o.instrumentUid).catch(() => null))?.ticker ?? null) : null,
      quantity: Number(o.quantity ?? 0),
      price: q(o.price),
      payment: q(o.payment),
    })),
  );
}
