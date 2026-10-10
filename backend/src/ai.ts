import { z } from 'zod';
import { config } from './config.js';
import { HttpError } from './http.js';
import type { IndicatorSnapshot } from './indicators.js';
import type { Candle, Quote } from './moex.js';

const levels = z.array(z.coerce.number()).max(5).catch([]);
const strings = z.array(z.string()).max(8).catch([]);

export const analysisResultSchema = z.object({
  signal: z.preprocess((v) => String(v).toUpperCase(), z.enum(['BUY', 'SELL', 'HOLD'])),
  // Models occasionally answer 0..100 instead of 0..1.
  confidence: z.preprocess((v) => {
    const n = Number(v);
    return n > 1 ? n / 100 : n;
  }, z.number().min(0).max(1)),
  horizon: z.enum(['days', 'weeks', 'months']).catch('weeks'),
  summary: z.string().min(1),
  trend: z.string().default(''),
  bullish: strings,
  bearish: strings,
  risks: strings,
  levels: z.object({ support: levels, resistance: levels }).catch({ support: [], resistance: [] }),
  plan: z.string().default(''),
  answer: z.string().nullish(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;

const SYSTEM_PROMPT = `Ты — аналитик российского фондового рынка (MOEX). Делаешь технический разбор одной бумаги для частного инвестора.

Правила:
- Опирайся ТОЛЬКО на переданные данные (котировка, индикаторы, дневные свечи). Новостей и отчётности у тебя нет — не выдумывай их, но можешь указать, какие внешние факторы стоит проверить.
- Будь конкретен: ссылайся на значения индикаторов и уровни цен.
- Уровни поддержки/сопротивления бери из реальных экстремумов и скользящих средних в данных.
- confidence отражает силу и согласованность сигналов (0.5 — неопределённость). Не завышай.
- Если данных мало или картина противоречивая — выбирай HOLD.
- Пиши по-русски, кратко, без воды.

Ответ — строго JSON-объект без markdown:
{
  "signal": "BUY" | "SELL" | "HOLD",
  "confidence": число от 0 до 1,
  "horizon": "days" | "weeks" | "months",
  "summary": "2-3 предложения: главный вывод",
  "trend": "одно предложение о текущем тренде",
  "bullish": ["аргументы за рост"],
  "bearish": ["аргументы за падение"],
  "risks": ["ключевые риски и что проверить"],
  "levels": { "support": [числа], "resistance": [числа] },
  "plan": "при каких условиях вывод меняется (например, пробой уровня)",
  "answer": "ответ на вопрос пользователя, если он задан, иначе null"
}`;

export function aiConfigured(): boolean {
  return config.AI_API_KEY.length > 0;
}

function buildUserPrompt(quote: Quote, indicators: IndicatorSnapshot, daily: Candle[], question?: string) {
  const recent = daily.slice(-60).map((c) => [c.time.slice(0, 10), c.open, c.high, c.low, c.close, Math.round(c.value)]);
  return JSON.stringify({
    instrument: { secid: quote.secid, name: quote.name, lotSize: quote.lotSize },
    quote: {
      price: quote.price,
      prevClose: quote.prevPrice,
      changeTodayPct: quote.changePct,
      updateTimeMsk: quote.updateTime,
    },
    indicators,
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
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(120_000),
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

function parseResult(content: string): AnalysisResult {
  // Strip a ```json fence if the model added one despite instructions.
  const json = content.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, '');
  return analysisResultSchema.parse(JSON.parse(json));
}

export async function analyze(
  quote: Quote,
  indicators: IndicatorSnapshot,
  daily: Candle[],
  question?: string,
): Promise<AnalysisResult> {
  if (!aiConfigured()) throw new HttpError(503, 'AI не настроен: задайте AI_API_KEY в .env');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(quote, indicators, daily, question) },
  ];
  const first = await chat(messages);
  try {
    return parseResult(first);
  } catch (err) {
    // One repair attempt: show the model its own output and the validation error.
    const reason = err instanceof Error ? err.message : String(err);
    const second = await chat([
      ...messages,
      { role: 'assistant', content: first },
      { role: 'user', content: `Ответ не прошёл проверку схемы: ${reason.slice(0, 500)}. Верни исправленный JSON целиком.` },
    ]);
    try {
      return parseResult(second);
    } catch {
      throw new HttpError(502, 'AI вернул ответ в неверном формате, попробуйте ещё раз');
    }
  }
}
