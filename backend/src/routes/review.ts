import { Router } from 'express';
import { z } from 'zod';
import { guarded, isRunning, reviewInstruments, type ReviewInput, type ReviewScope } from '../ai.js';
import { config } from '../config.js';
import { getMarketContext, relativeToIndex } from '../context.js';
import { pool } from '../db.js';
import { HttpError } from '../http.js';
import { computeIndicators } from '../indicators.js';
import { daysAgo, getCandles, getIndexComposition, getQuotes } from '../moex.js';
import { getNewsSafe, headlines, MARKET_NEWS_QUERY, newsQueryFor } from '../news.js';
import { companyForPrompt, getCompanyData } from '../tinkoff.js';

export const reviewRouter = Router();

const MAX_WATCHLIST_ITEMS = 30;
const scopeSchema = z.enum(['watchlist', 'imoex']);

type Row = {
  id: number;
  created_at: Date;
  model: string;
  scope: string;
  status: 'running' | 'done' | 'failed';
  error: string | null;
  secids: string[];
  result: unknown;
  snapshot: unknown;
  news: unknown;
};

const toDto = (r: Row) => ({
  id: r.id,
  createdAt: r.created_at,
  model: r.model,
  scope: r.scope,
  status: r.status,
  error: r.error,
  secids: r.secids,
  result: r.result,
  snapshot: r.snapshot,
  news: r.news,
});

reviewRouter.get('/', async (req, res) => {
  const scope = scopeSchema.parse(req.query.scope);
  const limit = z.coerce.number().int().min(1).max(50).catch(10).parse(req.query.limit);
  const { rows } = await pool.query<Row>('SELECT * FROM reviews WHERE scope = $1 ORDER BY created_at DESC LIMIT $2', [
    scope,
    limit,
  ]);
  res.json(rows.map(toDto));
});

reviewRouter.get('/:id', async (req, res) => {
  const { rows } = await pool.query<Row>('SELECT * FROM reviews WHERE id = $1', [z.coerce.number().int().parse(req.params.id)]);
  if (!rows[0]) throw new HttpError(404, 'Обзор не найден');
  res.json(toDto(rows[0]));
});

reviewRouter.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM reviews WHERE id = $1', [z.coerce.number().int().parse(req.params.id)]);
  res.json({ ok: true });
});

async function scopeSecids(scope: ReviewScope): Promise<string[]> {
  if (scope === 'imoex') return (await getIndexComposition()).map((m) => m.secid);
  const { rows } = await pool.query<{ secid: string }>('SELECT secid FROM watchlist ORDER BY added_at');
  if (rows.length === 0) throw new HttpError(422, 'Вотчлист пуст — добавьте бумаги');
  if (rows.length > MAX_WATCHLIST_ITEMS) throw new HttpError(422, `Для обзора максимум ${MAX_WATCHLIST_ITEMS} бумаг в вотчлисте`);
  return rows.map((r) => r.secid);
}

/** Gathers data and calls the model; can take 1–3 minutes for the whole index, so it runs detached from the request. */
async function runReview(id: number, scope: ReviewScope, secids: string[]) {
  const [quoteList, market, marketNews] = await Promise.all([getQuotes(secids), getMarketContext(), getNewsSafe(MARKET_NEWS_QUERY, 7, 15)]);
  const quotes = new Map(quoteList.map((q) => [q.secid, q]));

  // Fetch history in small batches to stay polite with MOEX ISS.
  const inputs: ReviewInput[] = [];
  for (let i = 0; i < secids.length; i += 5) {
    const batch = await Promise.all(
      secids.slice(i, i + 5).map(async (secid) => {
        const daily = await getCandles(secid, 24, daysAgo(400)).catch(() => []);
        const quote = quotes.get(secid);
        if (daily.length < 30 || !quote) return null;
        const indicators = computeIndicators(daily);
        return {
          secid,
          name: quote.name,
          price: quote.price,
          changeTodayPct: quote.changePct,
          indicators,
          relativeToIndex: await relativeToIndex(secid, indicators, market),
          // The index review covers ~45 instruments; keep the prompt compact and use market news only.
          recentCloses: daily.slice(scope === 'imoex' ? -5 : -20).map((c) => c.close),
          news: scope === 'watchlist' ? headlines(await getNewsSafe(newsQueryFor(secid, quote.name), 14, 4)) : undefined,
          company: companyForPrompt(await getCompanyData(secid)),
        };
      }),
    );
    for (const item of batch) if (item) inputs.push(item);
  }
  if (inputs.length === 0) throw new HttpError(422, 'Недостаточно истории торгов для обзора');

  const result = await reviewInstruments(scope, inputs, market, headlines(marketNews));
  const snapshot = inputs.map(({ secid, name, price, changeTodayPct, indicators }) => ({ secid, name, price, changeTodayPct, indicators }));
  await pool.query(`UPDATE reviews SET status = 'done', secids = $2, result = $3, snapshot = $4, news = $5 WHERE id = $1`, [
    id,
    inputs.map((i) => i.secid),
    result,
    JSON.stringify(snapshot),
    JSON.stringify(marketNews),
  ]);
}

/** Starts a review and returns 202 with its id; the client polls GET /review/:id until status != running. */
reviewRouter.post('/', async (req, res) => {
  const scope = scopeSchema.parse(req.body?.scope);
  if (isRunning(`review:${scope}`)) throw new HttpError(409, 'Обзор уже выполняется — подождите, он скоро появится');
  const secids = await scopeSecids(scope);
  const { rows } = await pool.query<Row>(
    `INSERT INTO reviews (model, scope, status, secids) VALUES ($1, $2, 'running', $3) RETURNING *`,
    [config.AI_MODEL, scope, secids],
  );
  const job = rows[0];

  void guarded(`review:${scope}`, () => runReview(job.id, scope, secids)).catch(async (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (!(err instanceof HttpError && err.status === 409)) console.error(`Review ${job.id} failed: ${message}`);
    await pool.query(`UPDATE reviews SET status = 'failed', error = $2 WHERE id = $1`, [job.id, message]);
  });

  res.status(202).json(toDto(job));
});
