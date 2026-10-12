import { Router } from 'express';
import { z } from 'zod';
import { aiConfigured, analyze, guarded } from '../ai.js';
import { config } from '../config.js';
import { getMarketContext, relativeToIndex } from '../context.js';
import { pool } from '../db.js';
import { HttpError } from '../http.js';
import { computeIndicators } from '../indicators.js';
import { getNewsSafe, headlines, newsQueryFor } from '../news.js';
import { buildScorecard, pastCallsFor } from '../scorecard.js';
import { companyForPrompt, getCompanyData } from '../tinkoff.js';
import { daysAgo, getCandles, getQuote } from '../moex.js';
import { secidSchema } from './market.js';

export const analysisRouter = Router();

type Row = {
  id: number;
  secid: string;
  shortname: string;
  created_at: Date;
  model: string;
  price: string;
  signal: string;
  confidence: string;
  question: string | null;
  result: unknown;
  indicators: unknown;
  news: unknown;
};

const toDto = (r: Row) => ({
  id: r.id,
  secid: r.secid,
  shortname: r.shortname,
  createdAt: r.created_at,
  model: r.model,
  price: Number(r.price),
  signal: r.signal,
  confidence: Number(r.confidence),
  question: r.question,
  result: r.result,
  indicators: r.indicators,
  news: r.news,
});

analysisRouter.get('/status', (_req, res) => {
  res.json({ configured: aiConfigured(), model: config.AI_MODEL });
});

/** Indicators only, no AI call — cheap enough to show on every instrument page. */
analysisRouter.get('/indicators/:secid', async (req, res) => {
  const secid = secidSchema.parse(req.params.secid);
  res.json(computeIndicators(await getCandles(secid, 24, daysAgo(400))));
});

/** How past verdicts fared against real prices. */
analysisRouter.get('/scorecard', async (_req, res) => {
  res.json(await buildScorecard());
});

analysisRouter.get('/', async (req, res) => {
  const { secid, limit } = z
    .object({ secid: secidSchema.optional(), limit: z.coerce.number().int().min(1).max(200).default(50) })
    .parse(req.query);
  const { rows } = await pool.query<Row>(
    `SELECT * FROM analyses WHERE ($1::text IS NULL OR secid = $1) ORDER BY created_at DESC LIMIT $2`,
    [secid ?? null, limit],
  );
  res.json(rows.map(toDto));
});

analysisRouter.get('/:id', async (req, res) => {
  const id = z.coerce.number().int().parse(req.params.id);
  const { rows } = await pool.query<Row>('SELECT * FROM analyses WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Анализ не найден');
  res.json(toDto(rows[0]));
});

analysisRouter.delete('/:id', async (req, res) => {
  const id = z.coerce.number().int().parse(req.params.id);
  await pool.query('DELETE FROM analyses WHERE id = $1', [id]);
  res.json({ ok: true });
});

analysisRouter.post('/:secid', async (req, res) => {
  const secid = secidSchema.parse(req.params.secid);
  const { question } = z.object({ question: z.string().trim().max(1000).optional() }).parse(req.body ?? {});

  const [quote, daily] = await Promise.all([getQuote(secid), getCandles(secid, 24, daysAgo(400))]);
  if (daily.length < 30) throw new HttpError(422, 'Слишком мало истории торгов для анализа');
  const indicators = computeIndicators(daily);
  const [market, news, company, pastCalls] = await Promise.all([
    getMarketContext(),
    getNewsSafe(newsQueryFor(secid, quote.name), 14, 12),
    getCompanyData(secid),
    pastCallsFor(secid, daily),
  ]);
  const relative = await relativeToIndex(secid, indicators, market);
  const result = await guarded(`analysis:${secid}`, () =>
    analyze(
      quote,
      indicators,
      daily,
      { market, relative, news: headlines(news), company: companyForPrompt(company), pastCalls },
      question || undefined,
    ),
  );

  const { rows } = await pool.query<Row>(
    `INSERT INTO analyses (secid, shortname, model, price, signal, confidence, question, result, indicators, news)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      secid,
      quote.shortname,
      config.AI_MODEL,
      quote.price ?? indicators.close,
      result.signal,
      result.confidence,
      question || null,
      result,
      indicators,
      JSON.stringify(news),
    ],
  );
  res.json(toDto(rows[0]));
});
