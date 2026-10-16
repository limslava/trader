import { z } from 'zod';
import { askJson, guarded, isRunning, localModels } from './ai.js';
import { config } from './config.js';
import { getMarketContext } from './context.js';
import { pool } from './db.js';
import { headlines } from './news.js';
import { marketNews, urgentEvents } from './feeds.js';
import { HttpError, TtlCache, todayMsk } from './http.js';
import { getCandles, getQuotes, INDEX_SECID } from './moex.js';
import { screener, type ScreenerRow } from './routes/screener.js';
import { SECTOR_RU } from './tinkoff.js';
import { tradingStatus } from './trading.js';

/**
 * Arena: autonomous AI agents with different characters and models, each trading a virtual account once a day.
 * The model only proposes orders in JSON; a deterministic risk layer decides what actually gets filled, at the live
 * exchange price with the broker's commission. Accounts live in our own tables (the broker sandbox allows only ten
 * accounts per token). A tournament to learn which style and model survive the Russian market, never real money.
 */

export const RISK = {
  maxPositionPct: 10, // one stock may not exceed this share of the account
  maxOrdersPerRun: 3,
  maxTradesPerWeek: 12,
  drawdownStopPct: 15, // the agent is stopped once it loses this much from its peak
  minOrderRub: 1_000,
  commission: 0.0005,
};

// Three decision sessions a day while the exchange is open: after the open, midday, before the close.
export const RUN_HOURS_MSK = [10, 13, 16];
const SNAPSHOT_HOUR_MSK = 19; // after the main session close (18:50)

export type PersonaKey = 'value' | 'momentum' | 'contrarian' | 'dividend' | 'quant' | 'neutral';

export const PERSONAS: Record<PersonaKey, { name: string; tagline: string; style: string }> = {
  value: {
    name: 'Фундаменталист',
    tagline: 'Покупает дёшево относительно прибыли и капитала, держит долго',
    style:
      'Ты стоимостной инвестор. Смотришь на P/E, P/B, ROE, долг, свободный денежный поток. Покупаешь, когда бизнес стоит дёшево относительно прибыли, и не обращаешь внимания на краткосрочные колебания. Торгуешь редко: 1–2 сделки в неделю — уже много. Продаёшь только если идея сломалась или бумага стала явно дорогой.',
  },
  momentum: {
    name: 'Трендовик',
    tagline: 'Покупает то, что уже растёт, и режет убытки быстро',
    style:
      'Ты трендовый трейдер. Покупаешь бумаги, которые сильнее индекса за 1–3 месяца, торгуются выше SMA50 и SMA200, с нормальным RSI (не выше 75). Продаёшь, как только тренд ломается (цена ниже SMA50, падение относительно индекса) или позиция ушла в минус больше 7%. Не ловишь падающие ножи.',
  },
  contrarian: {
    name: 'Контрарианец',
    tagline: 'Покупает перепроданное качество, продаёт на эйфории',
    style:
      'Ты контртрендовый инвестор. Ищешь качественные компании, которые сильно упали без ухудшения бизнеса: RSI ниже 35, далеко от максимума за год, негативный новостной фон уже в цене. Продаёшь, когда бумага восстановилась и RSI выше 70. Терпелив, но не покупаешь компании с реальными проблемами (санкции, убытки, допэмиссия).',
  },
  dividend: {
    name: 'Рантье',
    tagline: 'Собирает портфель из стабильных дивидендных историй',
    style:
      'Ты дивидендный инвестор. Выбираешь компании с высокой и устойчивой дивидендной доходностью, низким долгом и историей выплат. Сравниваешь доходность с ОФЗ и ключевой ставкой: если дивиденды заметно ниже ставки, бумага не интересна. Диверсифицируешь по отраслям. Продаёшь при отмене дивидендов или резком росте долга.',
  },
  neutral: {
    name: 'Инвестор',
    tagline: 'Разумный частный инвестор без перекосов: сам решает, на что смотреть',
    style:
      'Ты разумный частный инвестор без заданного стиля. Сам решаешь, что важнее сегодня: оценка бизнеса, тренд, дивиденды, новости или риск. Цель — обыграть индекс Мосбиржи и ОФЗ на горизонте месяцев с умеренным риском: 5–8 позиций, разные отрасли, сделки только при понятной причине.',
  },
  quant: {
    name: 'Квант',
    tagline: 'Верит цифрам: действует по квант-скору и правилам',
    style:
      'Ты системный трейдер. Опираешься на quantScore (0–100) и его составляющие, а не на новости и мнения. Покупаешь бумаги с скором 65+, продаёшь при падении ниже 45. Держишь 5–8 позиций равными долями. Помни: проверка показала, что скор не предсказывал доходность за последний год (рынок разворачивался), поэтому добавляй фильтр: не покупай после роста более 25% за месяц.',
  },
};

// --- Agents ---

export type Agent = {
  id: number;
  name: string;
  persona: PersonaKey;
  model: string | null;
  accountId: string | null;
  startCapital: number;
  cash: number;
  status: 'active' | 'stopped';
  stopReason: string | null;
  createdAt: string;
  group: GroupKey;
};

type AgentRow = {
  id: number;
  name: string;
  persona: PersonaKey;
  model: string | null;
  account_id: string | null;
  start_capital: string;
  cash: string;
  status: 'active' | 'stopped';
  stop_reason: string | null;
  created_at: Date;
  group_key: GroupKey;
};

const toAgent = (r: AgentRow): Agent => ({
  id: r.id,
  name: r.name,
  persona: r.persona,
  model: r.model,
  accountId: r.account_id,
  startCapital: Number(r.start_capital),
  cash: Number(r.cash),
  status: r.status,
  stopReason: r.stop_reason,
  createdAt: r.created_at.toISOString(),
  group: r.group_key,
});

export async function listAgents(): Promise<Agent[]> {
  const { rows } = await pool.query<AgentRow>('SELECT * FROM arena_agents ORDER BY group_key, id');
  return rows.map(toAgent);
}

async function getAgent(id: number): Promise<Agent> {
  const { rows } = await pool.query<AgentRow>('SELECT * FROM arena_agents WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Агент не найден');
  return toAgent(rows[0]);
}

/** Opens one sandbox account per persona and funds it; the user's own account is untouched. */
export type GroupKey = 'main' | 'models' | 'styles';

export const GROUPS: Record<GroupKey, { title: string; description: string }> = {
  main: { title: 'Основной', description: 'Пять характеров, модель у каждого своя — можно менять на ходу.' },
  models: { title: 'Модели', description: 'Один нейтральный характер на каждой модели: кто из моделей лучше рассуждает о рынке.' },
  styles: { title: 'Стили', description: 'Каждый характер на каждой модели: какой стиль выживает независимо от модели.' },
};

const STYLE_PERSONAS: PersonaKey[] = ['value', 'momentum', 'contrarian', 'dividend', 'quant'];

const modelShort = (m: string) => m.replace(/^ollama\//, '');

async function createAgent(group: GroupKey, persona: PersonaKey, model: string | null, capital: number): Promise<Agent> {
  const name = group === 'main' ? PERSONAS[persona].name : `${PERSONAS[persona].name} · ${modelShort(model ?? config.AI_MODEL)}`;
  const { rows } = await pool.query<AgentRow>(
    'INSERT INTO arena_agents (name, persona, model, start_capital, cash, group_key) VALUES ($1, $2, $3, $4, $4, $5) RETURNING *',
    [name, persona, model, capital, group],
  );
  const agent = toAgent(rows[0]);
  await snapshot(agent).catch(() => undefined);
  return agent;
}

/**
 * Opens one sandbox account per agent and funds it; the user's own account is untouched.
 * main: five personas on the default model; models: the neutral persona on every model; styles: every persona on every model.
 */
export async function setupGroup(group: GroupKey, capital: number) {
  if ((await listAgents()).some((a) => a.group === group)) throw new HttpError(409, `Турнир «${GROUPS[group].title}» уже создан`);
  const models = await availableModels();
  if (group !== 'main' && models.length < 2) throw new HttpError(422, 'Для сравнения нужны хотя бы две модели (облачная и/или в Ollama)');
  const plan: { persona: PersonaKey; model: string | null }[] =
    group === 'main'
      ? STYLE_PERSONAS.map((persona) => ({ persona, model: null }))
      : group === 'models'
        ? models.map((m) => ({ persona: 'neutral' as PersonaKey, model: m.id }))
        : STYLE_PERSONAS.flatMap((persona) => models.map((m) => ({ persona, model: m.id })));
  const created: Agent[] = [];
  for (const p of plan) created.push(await createAgent(group, p.persona, p.model, capital));
  leaderboardCache.clear();
  return created;
}

/** Forgets the group's agents; positions, trades and the journal go with them. */
export async function teardownGroup(group: GroupKey) {
  await pool.query('DELETE FROM arena_agents WHERE group_key = $1', [group]);
  leaderboardCache.clear();
}

// --- Virtual accounts ---

export type AgentPortfolio = {
  total: number;
  cash: number;
  availableCash: number;
  positions: { secid: string; name: string; quantity: number; lots: number; blockedLots: number; averagePrice: number; currentPrice: number | null; value: number | null; expectedYield: number | null }[];
};

type PositionRow = { secid: string; quantity: number; avg_price: string };

/** Positions valued at live exchange prices; a position with no quote is carried at its average price. */
export async function agentPortfolio(agent: Agent): Promise<AgentPortfolio> {
  const [{ rows: cashRows }, { rows }] = await Promise.all([
    pool.query<{ cash: string }>('SELECT cash FROM arena_agents WHERE id = $1', [agent.id]),
    pool.query<PositionRow>('SELECT secid, quantity, avg_price FROM arena_positions WHERE agent_id = $1 ORDER BY secid', [agent.id]),
  ]);
  const cash = Number(cashRows[0]?.cash ?? agent.cash);
  const quotes = new Map(rows.length ? (await getQuotes(rows.map((r) => r.secid)).catch(() => [])).map((q) => [q.secid, q]) : []);
  const positions = rows.map((r) => {
    const q = quotes.get(r.secid);
    const avg = Number(r.avg_price);
    const price = q?.price ?? null;
    const value = (price ?? avg) * r.quantity;
    return {
      secid: r.secid,
      name: q?.shortname ?? r.secid,
      quantity: r.quantity,
      lots: q?.lotSize ? Math.floor(r.quantity / q.lotSize) : r.quantity,
      blockedLots: 0,
      averagePrice: avg,
      currentPrice: price,
      value,
      expectedYield: value - avg * r.quantity,
    };
  });
  const total = cash + positions.reduce((s, p) => s + (p.value ?? 0), 0);
  return { total, cash, availableCash: cash, positions: positions.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)) };
}

/** Fills a market order instantly at the given price; cash and the position change in one transaction. */
export async function fillVirtual(agent: Agent, runId: number | null, secid: string, direction: 'buy' | 'sell', quantity: number, price: number) {
  const amount = quantity * price;
  const commission = amount * RISK.commission;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (direction === 'buy') {
      const { rows } = await client.query<{ cash: string }>('UPDATE arena_agents SET cash = cash - $2 WHERE id = $1 RETURNING cash', [agent.id, amount + commission]);
      if (Number(rows[0].cash) < 0) throw new HttpError(422, 'Не хватает денег');
      await client.query(
        `INSERT INTO arena_positions (agent_id, secid, quantity, avg_price) VALUES ($1, $2, $3, $4)
         ON CONFLICT (agent_id, secid) DO UPDATE
           SET avg_price = (arena_positions.avg_price * arena_positions.quantity + $4 * $3) / (arena_positions.quantity + $3),
               quantity = arena_positions.quantity + $3`,
        [agent.id, secid, quantity, price],
      );
    } else {
      const { rows } = await client.query<{ quantity: number }>('UPDATE arena_positions SET quantity = quantity - $3 WHERE agent_id = $1 AND secid = $2 AND quantity >= $3 RETURNING quantity', [agent.id, secid, quantity]);
      if (!rows[0]) throw new HttpError(422, 'Нет такого количества бумаг');
      if (rows[0].quantity === 0) await client.query('DELETE FROM arena_positions WHERE agent_id = $1 AND secid = $2', [agent.id, secid]);
      await client.query('UPDATE arena_agents SET cash = cash + $2 WHERE id = $1', [agent.id, amount - commission]);
    }
    await client.query(
      'INSERT INTO arena_trades (agent_id, run_id, secid, direction, quantity, price, amount, commission) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [agent.id, runId, secid, direction, quantity, price, amount, commission],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  return { amount, commission };
}

/** Models an agent may use: the cloud default plus whatever Ollama has installed. */
export async function availableModels() {
  const cloud = config.AI_API_KEY ? [{ id: config.AI_MODEL, label: `${config.AI_MODEL} (облако)`, local: false }] : [];
  const local = (await localModels()).map((m) => ({ id: m.id, label: `${m.id.slice('ollama/'.length)} (локально, ${m.sizeGb} ГБ)`, local: true }));
  return [...cloud, ...local];
}

export async function setAgentModel(id: number, model: string | null) {
  if (model !== null) {
    const ok = (await availableModels()).some((m) => m.id === model);
    if (!ok) throw new HttpError(422, 'Такой модели нет: проверьте, что она скачана в Ollama');
  }
  await pool.query('UPDATE arena_agents SET model = $2 WHERE id = $1', [id, model]);
  leaderboardCache.clear();
}

export async function setAgentStatus(id: number, status: Agent['status'], reason: string | null = null) {
  await pool.query('UPDATE arena_agents SET status = $2, stop_reason = $3 WHERE id = $1', [id, status, reason]);
  leaderboardCache.clear();
}

export async function isPaused(): Promise<boolean> {
  const { rows } = await pool.query<{ paused: boolean }>('SELECT paused FROM arena_settings WHERE id = 1');
  return rows[0]?.paused ?? false;
}

export async function setPaused(paused: boolean) {
  await pool.query('UPDATE arena_settings SET paused = $1 WHERE id = 1', [paused]);
}

// --- Shared data package: identical for every agent on a given run ---

type Universe = {
  date: string;
  market: unknown;
  news: string[];
  events: string[];
  instruments: {
    secid: string;
    name: string;
    sector: string;
    price: number | null;
    changeTodayPct: number;
    quantScore: number;
    tech: ScreenerRow['tech'];
    ratios: ScreenerRow['ratios'];
  }[];
};

const universeCache = new TtlCache<Universe>(20 * 60_000);

function buildUniverse(): Promise<Universe> {
  return universeCache.get('u', async () => {
    const [rows, market, news, events] = await Promise.all([screener(), getMarketContext(), marketNews(5, 15), urgentEvents(48, 12)]);
    return {
      date: todayMsk(),
      market,
      news: headlines(news),
      events: events.map((e) => `${e.tickers?.join(',') ?? ''}: ${e.title}`),
      instruments: rows.map((r) => ({
        secid: r.secid,
        name: r.shortname,
        sector: SECTOR_RU[r.sector] ?? r.sector,
        price: r.price,
        changeTodayPct: r.changePct,
        quantScore: r.score.total,
        tech: r.tech,
        ratios: r.ratios,
      })),
    };
  });
}

// --- The decision ---

const proposedOrder = z.object({
  secid: z.string().min(1).max(12),
  direction: z.enum(['buy', 'sell']),
  amountRub: z.number().nonnegative().optional(),
  sellAll: z.boolean().optional(),
  reason: z.string().max(400),
});
type ProposedOrder = z.infer<typeof proposedOrder>;

const decisionSchema = z.object({
  marketView: z.string().max(1500),
  reasoning: z.string().max(4000),
  orders: z.array(proposedOrder).max(10).default([]),
});

function systemPrompt(agent: Agent) {
  return `Ты — автономный торговый агент «${agent.name}» в турнире на учебных счетах российского рынка акций (Мосбиржа, TQBR). ${PERSONAS[agent.persona].style}

Турнир: несколько агентов с разными стилями стартовали с одинаковым капиталом; побеждает лучшая доходность с учётом просадки. Бенчмарк — индекс Мосбиржи и ОФЗ. Цель — обыграть их, а не просто торговать.

Правила (их проверяет отдельный риск-слой; нарушения будут отклонены):
- Торгуешь только бумагами из списка instruments (тикеры ровно как в поле secid). Только рыночные заявки, только за свои деньги (без плеча и шортов).
- Ты принимаешь решения ${RUN_HOURS_MSK.length} раза в день (${RUN_HOURS_MSK.map((h) => `${h}:00`).join(', ')} МСК). За один ход не больше ${RISK.maxOrdersPerRun} заявок, за неделю не больше ${RISK.maxTradesPerWeek} сделок. Комиссия ${RISK.commission * 100}% от суммы — не крути позиции без причины.
- Одна бумага не больше ${RISK.maxPositionPct}% счёта (equity). Покупка: укажи amountRub (сумма в рублях). Продажа: amountRub или sellAll: true.
- Если хороших идей нет — верни пустой список orders. Бездействие — нормальное решение. Деньги на счёте не обесцениваются в турнире, но и не приносят доход.
- Учитывай российскую специфику: ключевая ставка ЦБ, курс рубля, санкции, дивидендные отсечки, доходность ОФЗ как альтернатива.
- Прошлые решения (pastRuns) — твоя память: держи линию, не дёргайся, но признавай ошибки.

Ответ — строго JSON без markdown:
{
  "marketView": "2–3 предложения: как видишь рынок сегодня",
  "reasoning": "ход мыслей: почему именно эти сделки или почему ничего не делаешь; 4–8 предложений, простым языком",
  "orders": [{ "secid": "SBER", "direction": "buy" | "sell", "amountRub": 10000, "sellAll": false, "reason": "коротко" }]
}`;
}

// --- Risk layer: turns proposals into orders that respect the limits ---

export type ExecutedOrder = {
  secid: string;
  direction: 'buy' | 'sell';
  lots: number;
  amountRub: number;
  status: 'filled' | 'rejected' | 'failed';
  reason: string;
};

async function tradesThisWeek(agentId: number): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM arena_trades WHERE agent_id = $1 AND at > now() - interval '7 days'`, [agentId]);
  return Number(rows[0]?.n ?? 0);
}

async function applyRisk(agent: Agent, runId: number, universe: Universe, proposed: ProposedOrder[]): Promise<ExecutedOrder[]> {
  const pf = await agentPortfolio(agent);
  const equity = pf.total ?? pf.cash;
  let cash = pf.availableCash;
  let weekTrades = await tradesThisWeek(agent.id);
  const known = new Set(universe.instruments.map((i) => i.secid));
  const out: ExecutedOrder[] = [];
  let accepted = 0;

  for (const p of proposed) {
    const secid = p.secid.toUpperCase();
    const base = { secid, direction: p.direction, lots: 0, amountRub: 0 };
    const reject = (reason: string) => out.push({ ...base, status: 'rejected', reason });
    if (!known.has(secid)) {
      reject('Бумаги нет в списке разрешённых');
      continue;
    }
    if (accepted >= RISK.maxOrdersPerRun) {
      reject(`Лимит ${RISK.maxOrdersPerRun} заявок в день`);
      continue;
    }
    if (weekTrades >= RISK.maxTradesPerWeek) {
      reject(`Лимит ${RISK.maxTradesPerWeek} сделок в неделю`);
      continue;
    }
    const status = await tradingStatus(secid).catch(() => null);
    if (!status?.canTrade || !status.marketOrderAvailable || !status.lastPrice) {
      reject('Торги по бумаге сейчас закрыты');
      continue;
    }
    const lotPrice = status.lastPrice * status.lot;
    const held = pf.positions.find((x) => x.secid === secid);
    let lots: number;
    if (p.direction === 'buy') {
      const cap = equity * (RISK.maxPositionPct / 100) - (held?.value ?? 0);
      const affordable = cash / (1 + RISK.commission);
      const amount = Math.min(p.amountRub ?? 0, cap, affordable);
      lots = Math.floor(amount / lotPrice);
      if (lots < 1 || amount < RISK.minOrderRub) {
        reject(
          cap < lotPrice
            ? `Позиция уже ${RISK.maxPositionPct}% счёта`
            : affordable < lotPrice
              ? 'Не хватает свободных денег'
              : `Сумма меньше одного лота (${lotPrice.toFixed(0)} ₽)`,
        );
        continue;
      }
    } else {
      const free = (held?.lots ?? 0) - (held?.blockedLots ?? 0);
      lots = p.sellAll ? free : Math.min(free, Math.floor((p.amountRub ?? 0) / lotPrice));
      if (lots < 1) {
        reject(free < 1 ? 'Такой бумаги нет на счёте' : 'Сумма меньше одного лота');
        continue;
      }
    }
    const amountRub = lots * lotPrice;
    try {
      await fillVirtual(agent, runId, secid, p.direction, lots * status.lot, status.lastPrice);
      out.push({ ...base, lots, amountRub, status: 'filled', reason: p.reason });
      accepted++;
      weekTrades++;
      cash += p.direction === 'buy' ? -amountRub * (1 + RISK.commission) : amountRub * (1 - RISK.commission);
    } catch (err) {
      out.push({ ...base, lots, amountRub, status: 'failed', reason: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}

// --- Runs ---

async function snapshot(agent: Agent) {
  const [pf, market] = await Promise.all([agentPortfolio(agent), getMarketContext().catch(() => null)]);
  await pool.query(
    `INSERT INTO arena_snapshots (agent_id, day, equity, cash, imoex) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (agent_id, day) DO UPDATE SET equity = EXCLUDED.equity, cash = EXCLUDED.cash, imoex = EXCLUDED.imoex`,
    [agent.id, todayMsk(), pf.total, pf.cash, market?.imoex?.value ?? null],
  );
  leaderboardCache.clear();
  return pf;
}

async function peakEquity(agent: Agent): Promise<number> {
  const { rows } = await pool.query<{ m: string | null }>('SELECT max(equity) AS m FROM arena_snapshots WHERE agent_id = $1', [agent.id]);
  return Math.max(agent.startCapital, Number(rows[0]?.m ?? 0));
}

export const agentRunning = (id: number) => isRunning(`arena:${id}`);

/** One decision session for one agent: data package → model → risk layer → journal. */
export function runAgent(id: number, shared?: Universe) {
  return guarded(`arena:${id}`, async () => {
    const agent = await getAgent(id);
    if (agent.status !== 'active') throw new HttpError(409, 'Агент остановлен');

    const pf = await agentPortfolio(agent);
    const equity = pf.total;
    const peak = await peakEquity(agent);
    const drawdownPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (drawdownPct >= RISK.drawdownStopPct) {
      const reason = `Просадка ${drawdownPct.toFixed(1)}% от максимума — стоп по риску`;
      await setAgentStatus(id, 'stopped', reason);
      throw new HttpError(409, reason);
    }

    const model = agent.model ?? config.AI_MODEL;
    const { rows } = await pool.query<{ id: number }>('INSERT INTO arena_runs (agent_id, equity_before, model) VALUES ($1, $2, $3) RETURNING id', [id, equity, model]);
    const runId = rows[0].id;
    try {
      const [universe, past, weekTrades] = await Promise.all([
        shared ?? buildUniverse(),
        pool.query<{ started_at: Date; market_view: string; reasoning: string; executed: ExecutedOrder[] }>(
          `SELECT started_at, market_view, reasoning, executed FROM arena_runs WHERE agent_id = $1 AND status = 'done' ORDER BY started_at DESC LIMIT 5`,
          [id],
        ),
        tradesThisWeek(agent.id),
      ]);
      const user = JSON.stringify({
        today: universe.date,
        account: {
          equityRub: equity,
          cashRub: pf.availableCash,
          startCapitalRub: agent.startCapital,
          returnPct: Number((((equity - agent.startCapital) / agent.startCapital) * 100).toFixed(2)),
          drawdownFromPeakPct: Number(drawdownPct.toFixed(2)),
          tradesThisWeek: weekTrades,
          positions: pf.positions.map((p) => ({
            secid: p.secid,
            quantity: p.quantity,
            valueRub: p.value,
            weightPct: equity ? Number((((p.value ?? 0) / equity) * 100).toFixed(1)) : 0,
            pnlRub: p.expectedYield,
          })),
        },
        pastRuns: past.rows.map((r) => ({
          date: r.started_at.toISOString().slice(0, 10),
          marketView: r.market_view,
          reasoning: r.reasoning?.slice(0, 600),
          trades: r.executed.filter((e) => e.status === 'filled').map((e) => `${e.direction} ${e.secid} ${Math.round(e.amountRub)} ₽`),
        })),
        marketContext: universe.market,
        marketNews: universe.news,
        companyEvents: universe.events,
        instruments: universe.instruments,
      });
      const decision = await askJson(systemPrompt(agent), user, decisionSchema, model);
      const executed = await applyRisk(agent, runId, universe, decision.orders);
      await pool.query(
        `UPDATE arena_runs SET status = 'done', finished_at = now(), market_view = $2, reasoning = $3, proposed = $4, executed = $5 WHERE id = $1`,
        [runId, decision.marketView, decision.reasoning, JSON.stringify(decision.orders), JSON.stringify(executed)],
      );
      await snapshot(agent).catch(() => undefined);
      return runId;
    } catch (err) {
      await pool.query(`UPDATE arena_runs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1`, [
        runId,
        err instanceof Error ? err.message : String(err),
      ]);
      throw err;
    }
  });
}

/** Runs every active agent one after another (gentle on MOEX and the AI budget); errors are per agent. */
let roundInFlight = false;
export const roundRunning = () => roundInFlight;

export async function runAll(): Promise<void> {
  // A double click on "run now" (or the scheduler firing during a manual round) must not start a second loop.
  if (roundInFlight) throw new HttpError(409, 'Раунд уже идёт');
  roundInFlight = true;
  try {
    // Same data package for everyone, and agents grouped by model so Ollama does not reload weights every turn.
    const universe = await buildUniverse();
    const agents = (await listAgents())
      .filter((a) => a.status === 'active' && !agentRunning(a.id))
      .sort((x, y) => (x.model ?? '').localeCompare(y.model ?? ''));
    for (const a of agents) {
      await runAgent(a.id, universe).catch((err) => console.error(`Arena: agent ${a.name} failed:`, err instanceof Error ? err.message : err));
    }
  } finally {
    roundInFlight = false;
  }
}

async function snapshotAll() {
  for (const a of await listAgents()) await snapshot(a).catch(() => undefined);
}

/** Weekdays at RUN_HOURS_MSK: decisions; 19:00 MSK: closing snapshots. Checked every minute. */
export function scheduleArena() {
  let lastRunSlot = '';
  let lastSnapDay = '';
  setInterval(async () => {
    const msk = new Date(Date.now() + 3 * 3600_000);
    const day = msk.toISOString().slice(0, 10);
    const weekday = msk.getUTCDay() >= 1 && msk.getUTCDay() <= 5;
    if (!weekday) return;
    try {
      const slot = `${day}:${msk.getUTCHours()}`;
      if (RUN_HOURS_MSK.includes(msk.getUTCHours()) && lastRunSlot !== slot) {
        lastRunSlot = slot;
        if (!(await isPaused())) await runAll().catch(() => undefined);
      } else if (msk.getUTCHours() === SNAPSHOT_HOUR_MSK && lastSnapDay !== day) {
        lastSnapDay = day;
        await snapshotAll();
      }
    } catch (err) {
      console.error('Arena scheduler:', err);
    }
  }, 60_000).unref();
}

// --- Leaderboard ---

export type LeaderboardRow = Agent & {
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
  /** Model actually used on the next run (agent's own or the cloud default). */
  effectiveModel: string;
};

export type LeaderboardGroup = {
  key: GroupKey;
  title: string;
  description: string;
  since: string | null;
  benchmarks: { imoexPct: number | null; ofzPct: number | null };
  agents: LeaderboardRow[];
};

export type Leaderboard = {
  paused: boolean;
  roundRunning: boolean;
  groups: LeaderboardGroup[];
};

const leaderboardCache = new TtlCache<Leaderboard>(60_000);

export function leaderboard(): Promise<Leaderboard> {
  return leaderboardCache.get('lb', async () => {
    const [agents, paused] = await Promise.all([listAgents(), isPaused()]);
    const rows = await Promise.all(agents.map(leaderboardRow));
    const groups: LeaderboardGroup[] = [];
    for (const key of Object.keys(GROUPS) as GroupKey[]) {
      const members = rows.filter((r) => r.group === key).sort((x, y) => y.returnPct - x.returnPct);
      const since = members.length ? members.reduce((m, a) => (a.createdAt < m ? a.createdAt : m), members[0].createdAt) : null;
      groups.push({
        key,
        ...GROUPS[key],
        since,
        benchmarks: since ? await benchmarkSince(since).catch(() => ({ imoexPct: null, ofzPct: null })) : { imoexPct: null, ofzPct: null },
        agents: members,
      });
    }
    return { paused, roundRunning: roundInFlight, groups };
  });
}

async function leaderboardRow(a: Agent): Promise<LeaderboardRow> {
  const [pf, snaps, stats, last] = await Promise.all([
    agentPortfolio(a).catch(() => null),
    pool.query<{ day: string; equity: string }>(`SELECT to_char(day, 'YYYY-MM-DD') AS day, equity FROM arena_snapshots WHERE agent_id = $1 ORDER BY day`, [a.id]),
    pool.query<{ n: string; fees: string | null }>('SELECT count(*) AS n, sum(commission) AS fees FROM arena_trades WHERE agent_id = $1', [a.id]),
    pool.query<{ started_at: Date }>('SELECT started_at FROM arena_runs WHERE agent_id = $1 ORDER BY started_at DESC LIMIT 1', [a.id]),
  ]);
  const equity = pf?.total ?? Number(snaps.rows.at(-1)?.equity ?? a.startCapital);
  const curve = snaps.rows.map((s) => ({ day: s.day, equity: Number(s.equity) }));
  const series = [a.startCapital, ...curve.map((c) => c.equity), equity];
  let peak = 0;
  let maxDd = 0;
  for (const v of series) {
    peak = Math.max(peak, v);
    maxDd = Math.max(maxDd, peak ? ((peak - v) / peak) * 100 : 0);
  }
  return {
    ...a,
    tagline: PERSONAS[a.persona]?.tagline ?? '',
    equity,
    cash: pf?.cash ?? 0,
    positions: pf?.positions.length ?? 0,
    returnPct: Number((((equity - a.startCapital) / a.startCapital) * 100).toFixed(2)),
    maxDrawdownPct: Number(maxDd.toFixed(2)),
    sharpe: sharpe(curve.map((c) => c.equity)),
    trades: Number(stats.rows[0]?.n ?? 0),
    feesRub: Number(stats.rows[0]?.fees ?? 0),
    running: agentRunning(a.id),
    lastRunAt: last.rows[0]?.started_at.toISOString() ?? null,
    curve,
    effectiveModel: a.model ?? config.AI_MODEL,
  };
}

/** Annualized Sharpe from daily equity points; needs at least a week of data to mean anything. */
function sharpe(equities: number[]): number | null {
  if (equities.length < 6) return null;
  const rets = equities.slice(1).map((e, i) => e / equities[i] - 1);
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1));
  return sd > 0 ? Number(((mean / sd) * Math.sqrt(252)).toFixed(2)) : null;
}

/** What the same money would have done in the index and in 1-year OFZ over the same period. */
async function benchmarkSince(since: string) {
  // Start from the last close before the tournament began (the agents bought at roughly that level).
  const from = new Date(new Date(since).getTime() - 10 * 86_400_000).toISOString().slice(0, 10);
  const [candles, market] = await Promise.all([getCandles(INDEX_SECID, 24, from), getMarketContext()]);
  const before = candles.filter((c) => c.time.slice(0, 10) < since.slice(0, 10));
  const start = (before.at(-1) ?? candles[0])?.close ?? null;
  const now = market.imoex?.value ?? candles.at(-1)?.close ?? null;
  const days = Math.max(1, (Date.now() - new Date(since).getTime()) / 86_400_000);
  return {
    imoexPct: start && now ? Number((((now - start) / start) * 100).toFixed(2)) : null,
    ofzPct: market.ofz?.y1 ? Number(((market.ofz.y1.yieldPct * days) / 365).toFixed(2)) : null,
  };
}

// --- Agent detail ---

export async function agentDetail(id: number) {
  const agent = await getAgent(id);
  const [pf, runs, snaps] = await Promise.all([
    agentPortfolio(agent).catch(() => null),
    pool.query<{
      id: number;
      started_at: Date;
      finished_at: Date | null;
      status: string;
      error: string | null;
      model: string | null;
      equity_before: string | null;
      market_view: string | null;
      reasoning: string | null;
      proposed: ProposedOrder[];
      executed: ExecutedOrder[];
    }>('SELECT * FROM arena_runs WHERE agent_id = $1 ORDER BY started_at DESC LIMIT 40', [id]),
    pool.query<{ day: string; equity: string; imoex: string | null }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, equity, imoex FROM arena_snapshots WHERE agent_id = $1 ORDER BY day`,
      [id],
    ),
  ]);
  return {
    agent: { ...agent, tagline: PERSONAS[agent.persona]?.tagline ?? '', style: PERSONAS[agent.persona]?.style ?? '', running: agentRunning(id) },
    portfolio: pf,
    runs: runs.rows.map((r) => ({
      id: r.id,
      startedAt: r.started_at.toISOString(),
      finishedAt: r.finished_at?.toISOString() ?? null,
      status: r.status,
      error: r.error,
      model: r.model,
      equityBefore: r.equity_before === null ? null : Number(r.equity_before),
      marketView: r.market_view,
      reasoning: r.reasoning,
      proposed: r.proposed,
      executed: r.executed,
    })),
    curve: snaps.rows.map((s) => ({ day: s.day, equity: Number(s.equity), imoex: s.imoex === null ? null : Number(s.imoex) })),
  };
}
