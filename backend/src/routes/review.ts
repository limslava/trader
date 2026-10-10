import { Router } from 'express';
import { z } from 'zod';
import { reviewInstruments, type ReviewInput } from '../ai.js';
import { config } from '../config.js';
import { getMarketContext, relativeToIndex } from '../context.js';
import { pool } from '../db.js';
import { HttpError } from '../http.js';
import { computeIndicators } from '../indicators.js';
import { daysAgo, getCandles, getIndexComposition, getQuotes } from '../moex.js';

export const reviewRouter = Router();

const MAX_WATCHLIST_ITEMS = 30;
const scopeSchema = z.enum(['watchlist', 'imoex']).catch('watchlist');

type Row = { id: number; created_at: Date; model: string; scope: string; secids: string[]; result: unknown; snapshot: unknown };

const toDto = (r: Row) => ({
  id: r.id,
  createdAt: r.created_at,
  model: r.model,
  scope: r.scope,
  secids: r.secids,
  result: r.result,
  snapshot: r.snapshot,
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

reviewRouter.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM reviews WHERE id = $1', [z.coerce.number().int().parse(req.params.id)]);
  res.json({ ok: true });
});

async function scopeSecids(scope: 'watchlist' | 'imoex'): Promise<string[]> {
  if (scope === 'imoex') return (await getIndexComposition()).map((m) => m.secid);
  const { rows } = await pool.query<{ secid: string }>('SELECT secid FROM watchlist ORDER BY added_at');
  if (rows.length === 0) throw new HttpError(422, 'Вотчлист пуст — добавьте бумаги');
  if (rows.length > MAX_WATCHLIST_ITEMS) throw new HttpError(422, `Для обзора максимум ${MAX_WATCHLIST_ITEMS} бумаг в вотчлисте`);
  return rows.map((r) => r.secid);
}

reviewRouter.post('/', async (req, res) => {
  const scope = scopeSchema.parse(req.body?.scope);
  const secids = await scopeSecids(scope);
  const [quoteList, market] = await Promise.all([getQuotes(secids), getMarketContext()]);
  const quotes = new Map(quoteList.map((q) => [q.secid, q]));

  // Fetch history in small batches to stay polite with MOEX ISS.
  const inputs: ReviewInput[] = [];
  for (let i = 0; i < secids.length; i += 5) {
    const batch = await Promise.all(
      secids.slice(i, i + 5).map(async (secid) => {
        const daily = await getCandles(secid, 24, daysAgo(400));
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
          // The index review covers ~45 instruments; keep the prompt compact.
          recentCloses: daily.slice(scope === 'imoex' ? -10 : -20).map((c) => c.close),
        };
      }),
    );
    for (const item of batch) if (item) inputs.push(item);
  }
  if (inputs.length === 0) throw new HttpError(422, 'Недостаточно истории торгов для обзора');

  const result = await reviewInstruments(scope, inputs, market);
  const snapshot = inputs.map(({ secid, name, price, changeTodayPct, indicators }) => ({
    secid,
    name,
    price,
    changeTodayPct,
    indicators,
  }));
  const { rows } = await pool.query<Row>(
    'INSERT INTO reviews (model, scope, secids, result, snapshot) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [config.AI_MODEL, scope, inputs.map((i) => i.secid), result, JSON.stringify(snapshot)],
  );
  res.json(toDto(rows[0]));
});
