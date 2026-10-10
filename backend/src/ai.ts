import { z } from 'zod';
import { config } from './config.js';
import type { MarketContext } from './context.js';
import { HttpError } from './http.js';
import type { IndicatorSnapshot } from './indicators.js';
import type { Candle, Quote } from './moex.js';

const levels = z.array(z.coerce.number()).max(5).catch([]);
const strings = z.array(z.string()).max(8).catch([]);
const signal = z.preprocess((v) => String(v).toUpperCase(), z.enum(['BUY', 'SELL', 'HOLD']));
// Models occasionally answer 0..100 instead of 0..1.
const confidence = z.preprocess((v) => {
  const n = Number(v);
  return n > 1 ? n / 100 : n;
}, z.number().min(0).max(1));

export const analysisResultSchema = z.object({
  signal,
  confidence,
  horizon: z.enum(['days', 'weeks', 'months']).catch('weeks'),
  summary: z.string().min(1),
  simple: z.string().default(''),
  trend: z.string().default(''),
  bullish: strings,
  bearish: strings,
  risks: strings,
  levels: z.object({ support: levels, resistance: levels }).catch({ support: [], resistance: [] }),
  plan: z.string().default(''),
  answer: z.string().nullish(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

/** Shared by all prompts: what is specific about the Russian market and about our user. */
const COMMON_RULES = `Пользователь — начинающий частный инвестор из России, торгует на Московской бирже в рублях.

Учитывай специфику российского рынка:
- Ключевая ставка ЦБ (передана в marketContext): высокая ставка делает депозиты и облигации конкурентами акциям и давит на рынок; ожидания снижения ставки обычно поддерживают акции. Сравнивай потенциал с доходностью вклада ≈ ставке.
- Индекс Мосбиржи (IMOEX) — ориентир рынка. Сравнивай бумагу с индексом (поля vsImoex*: положительное — сильнее рынка). Если бумага просто повторяет индекс, так и скажи.
- Курс рубля: ослабление рубля обычно выгодно экспортёрам (нефть, газ, металлы, удобрения), укрепление — внутренним компаниям.
- Дивиденды: многие российские компании платят высокие дивиденды; после даты отсечки цена падает на размер дивиденда (дивидендный гэп) — резкое падение в дни выплат может быть гэпом, а не плохим сигналом. Отдельного календаря дивидендов в данных нет: если отсечка упоминается в новостях — учти это, иначе посоветуй проверить даты.
- Геополитика, санкции, решения ЦБ и государства (налоги, обязательные продажи валюты) сильно влияют на рынок — новостей у тебя нет, но напоминай проверить их, если это важно для бумаги.
- Торги на MOEX идут и по выходным; акции покупаются лотами (lotSize).

Общие правила:
- Опирайся ТОЛЬКО на переданные данные. Отчётности у тебя нет — не выдумывай её.
- Заголовки новостей (news) — только заголовки за последние 2 недели, без текста статей. Учитывай их, если они важны (дивиденды, отчётность, санкции, сделки, аварии, решения регулятора), и ссылайся на них в аргументах и рисках. Не додумывай подробности, которых нет в заголовке. Если новостей нет или они нерелевантны — так и скажи. Заголовки с «прогнозами» и «идеями» — это мнения, не факты.
- Будь конкретен: ссылайся на значения индикаторов и уровни цен.
- confidence отражает силу и согласованность сигналов (0.5 — неопределённость). Не завышай. При противоречиях — HOLD.
- Давай чёткий вывод, а не «с одной стороны, с другой стороны»: стоит ли присматриваться к покупке, держать или лучше обойти — и почему. Решение принимает пользователь, твоя задача — дать ему ясный разбор данных.
- Не обещай доходность и не призывай вкладывать все деньги в одну бумагу.
- Пиши по-русски, кратко. Не используй названия полей из данных (change3mPct, sma200, vsImoex1yPct) — пиши по-человечески: «за 3 месяца», «200-дневная средняя», «отстаёт от индекса за год».
- Поле simple — объяснение для новичка без терминов (никаких RSI, MACD, SMA): что сейчас происходит с ценой, что это значит и на что обратить внимание. 3-4 простых предложения.`;

const SYSTEM_PROMPT = `Ты — аналитик российского фондового рынка. Делаешь технический разбор одной бумаги.

${COMMON_RULES}
- Уровни поддержки/сопротивления бери из реальных экстремумов и скользящих средних в данных.

Ответ — строго JSON-объект без markdown:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": число от 0 до 1,
  "horizon": "days" | "weeks" | "months",
  "summary": "2-3 предложения: главный вывод (можно с терминами)",
  "simple": "простыми словами для новичка",
  "trend": "одно предложение о текущем тренде",
  "bullish": ["аргументы за рост"],
  "bearish": ["аргументы за падение"],
  "risks": ["ключевые риски и что проверить, включая российскую специфику"],
  "levels": { "support": [числа], "resistance": [числа] },
  "plan": "при каких условиях вывод меняется (например, пробой уровня)",
  "answer": "ответ на вопрос пользователя простым языком, если он задан, иначе null"
}`;

export function aiConfigured(): boolean {
  return config.AI_API_KEY.length > 0;
}

export type AnalysisContext = { market: MarketContext; relative: Record<string, unknown>; news: string[] };

function buildUserPrompt(
  quote: Quote,
  indicators: IndicatorSnapshot,
  daily: Candle[],
  ctx: AnalysisContext,
  question?: string,
) {
  const recent = daily.slice(-60).map((c) => [c.time.slice(0, 10), c.open, c.high, c.low, c.close, Math.round(c.value)]);
  return JSON.stringify({
    instrument: { secid: quote.secid, name: quote.name, lotSize: quote.lotSize, lotCostRub: quote.price && quote.price * quote.lotSize },
    quote: {
      price: quote.price,
      prevClose: quote.prevPrice,
      changeTodayPct: quote.changePct,
      updateTimeMsk: quote.updateTime,
    },
    indicators,
    relativeToIndex: ctx.relative,
    marketContext: ctx.market,
    news: ctx.news,
    dailyCandles: { columns: ['date', 'open', 'high', 'low', 'close', 'turnoverRub'], rows: recent },
    userQuestion: question || null,
  });
}

async function chat(messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch(`${config.AI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.AI_API_KEY}` },
    body: JSON.stringify({
      model: config.AI_MODEL,
      messages,
      temperature: 0.2,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`AI API error ${res.status}: ${body.slice(0, 500)}`);
    throw new HttpError(502, `AI API вернул ошибку ${res.status}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, 'AI API вернул пустой ответ');
  return content;
}

function parseJson<T>(content: string, schema: z.ZodType<T>): T {
  // Strip a ```json fence if the model added one despite instructions.
  const json = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '');
  return schema.parse(JSON.parse(json));
}

/** Calls the model expecting JSON matching `schema`, with one repair attempt on invalid output. */
async function askJson<T>(system: string, user: string, schema: z.ZodType<T>): Promise<T> {
  if (!aiConfigured()) throw new HttpError(503, 'AI не настроен: задайте AI_API_KEY в .env');

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
  const first = await chat(messages);
  try {
    return parseJson(first, schema);
  } catch (err) {
    // Show the model its own output and the validation error.
    const reason = err instanceof Error ? err.message : String(err);
    const second = await chat([
      ...messages,
      { role: 'assistant', content: first },
      { role: 'user', content: `Ответ не прошёл проверку схемы: ${reason.slice(0, 500)}. Верни исправленный JSON целиком.` },
    ]);
    try {
      return parseJson(second, schema);
    } catch {
      throw new HttpError(502, 'AI вернул ответ в неверном формате, попробуйте ещё раз');
    }
  }
}

export function analyze(
  quote: Quote,
  indicators: IndicatorSnapshot,
  daily: Candle[],
  ctx: AnalysisContext,
  question?: string,
): Promise<AnalysisResult> {
  return askJson(SYSTEM_PROMPT, buildUserPrompt(quote, indicators, daily, ctx, question), analysisResultSchema);
}

// --- Group review: one call comparing many instruments (watchlist or the whole index) ---

const pick = z.object({ secid: z.string(), reason: z.string() });

export const reviewResultSchema = z.object({
  summary: z.string().min(1),
  simple: z.string().default(''),
  market: z.string().default(''),
  items: z.array(z.object({ secid: z.string(), signal, confidence, comment: z.string() })),
  top: z.array(pick).max(5).catch([]),
  avoid: z.array(pick).max(5).catch([]),
  risks: strings,
});

export type ReviewResult = z.infer<typeof reviewResultSchema>;
export type ReviewScope = 'watchlist' | 'imoex';

export type ReviewInput = {
  secid: string;
  name: string;
  price: number | null;
  changeTodayPct: number;
  indicators: IndicatorSnapshot;
  relativeToIndex: Record<string, unknown>;
  recentCloses: number[];
  news?: string[];
};

const SCOPE_INTRO: Record<ReviewScope, string> = {
  watchlist: 'Делаешь сравнительный технический обзор вотчлиста (списка бумаг, за которыми следит пользователь).',
  imoex:
    'Делаешь обзор российского рынка акций по бумагам индекса Мосбиржи (голубые фишки) для новичка, который не знает, с чего начать. Объясни, что сейчас происходит на рынке в целом, какие бумаги технически сильнее и слабее. Комментарии по бумагам — одно короткое предложение.',
};

function reviewPrompt(scope: ReviewScope) {
  return `Ты — аналитик российского фондового рынка. ${SCOPE_INTRO[scope]}

${COMMON_RULES}
- Сравнивай бумаги между собой и с индексом: у кого сильнее импульс, кто перекуплен/перепродан, кто слабее рынка.
- Если многие бумаги движутся одинаково (вместе с индексом) — отметь это как общий фактор.
- В items должна быть КАЖДАЯ бумага из входных данных, ровно один раз, с secid как во входе.
- top — до 3 технически самых сильных сейчас, avoid — до 3 самых слабых. Могут быть пустыми.

Ответ — строго JSON-объект без markdown:
{
  "summary": "3-4 предложения: главный вывод",
  "simple": "простыми словами для новичка",
  "market": "одно-два предложения: общая картина рынка (индекс, ставка ЦБ, рубль)",
  "items": [{ "secid": "SBER", "signal": "BUY" | "SELL" | "HOLD", "confidence": 0..1, "comment": "коротко" }],
  "top": [{ "secid": "...", "reason": "почему" }],
  "avoid": [{ "secid": "...", "reason": "почему" }],
  "risks": ["общие риски, включая российскую специфику"]
}`;
}

export async function reviewInstruments(
  scope: ReviewScope,
  inputs: ReviewInput[],
  market: MarketContext,
  marketNews: string[],
): Promise<ReviewResult> {
  const result = await askJson(
    reviewPrompt(scope),
    JSON.stringify({ marketContext: market, marketNews, instruments: inputs }),
    reviewResultSchema,
  );
  // Keep only instruments we actually sent, in input order, one entry each.
  const known = new Set(inputs.map((i) => i.secid));
  const bySecid = new Map(result.items.map((i) => [i.secid.toUpperCase(), { ...i, secid: i.secid.toUpperCase() }]));
  const onlyKnown = (picks: { secid: string; reason: string }[]) =>
    picks.map((p) => ({ ...p, secid: p.secid.toUpperCase() })).filter((p) => known.has(p.secid));
  return {
    ...result,
    items: inputs.flatMap((i) => bySecid.get(i.secid) ?? []),
    top: onlyKnown(result.top),
    avoid: onlyKnown(result.avoid),
  };
}
