import { Router } from 'express';
import { z } from 'zod';
import { reviewWatchlist, type ReviewInput } from '../ai.js';
import { config } from '../config.js';
import { pool } from '../db.js';
import { HttpError } from '../http.js';
import { computeIndicators } from '../indicators.js';
import { daysAgo, getCandles, getQuotes } from '../moex.js';

export const reviewRouter = Router();

const MAX_ITEMS = 30;

type Row = { id: number; created_at: Date; model: string; secids: string[]; result: unknown; snapshot: unknown };

const toDto = (r: Row) => ({
  id: r.id,
  createdAt: r.created_at,
  model: r.model,
  secids: r.secids,
  result: r.result,
  snapshot: r.snapshot,
});

reviewRouter.get('/', async (req, res) => {
  const limit = z.coerce.number().int().min(1).max(50).catch(10).parse(req.query.limit);
  const { rows } = await pool.query<Row>('SELECT * FROM reviews ORDER BY created_at DESC LIMIT $1', [limit]);
  res.json(rows.map(toDto));
});

reviewRouter.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM reviews WHERE id = $1', [z.coerce.number().int().parse(req.params.id)]);
  res.json({ ok: true });
});

reviewRouter.post('/', async (_req, res) => {
  const { rows: watch } = await pool.query<{ secid: string }>('SELECT secid FROM watchlist ORDER BY added_at');
  if (watch.length === 0) throw new HttpError(422, 'Вотчлист пуст — добавьте бумаги');
  if (watch.length > MAX_ITEMS) throw new HttpError(422, `Для обзора максимум ${MAX_ITEMS} бумаг в вотчлисте`);

  const secids = watch.map((w) => w.secid);
  const quotes = new Map((await getQuotes(secids)).map((q) => [q.secid, q]));

  // Fetch history in small batches to stay polite with MOEX ISS.
  const inputs: ReviewInput[] = [];
  for (let i = 0; i < secids.length; i += 5) {
    const batch = await Promise.all(
      secids.slice(i, i + 5).map(async (secid) => {
        const daily = await getCandles(secid, 24, daysAgo(400));
        const quote = quotes.get(secid);
        if (daily.length < 30 || !quote) return null;
        return {
          secid,
          name: quote.name,
          price: quote.price,
          changeTodayPct: quote.changePct,
          indicators: computeIndicators(daily),
          recentCloses: daily.slice(-20).map((c) => c.close),
        };
      }),
    );
    for (const item of batch) if (item) inputs.push(item);
  }
  if (inputs.length === 0) throw new HttpError(422, 'Недостаточно истории торгов для обзора');

  const result = await reviewWatchlist(inputs);
  const snapshot = inputs.map(({ secid, name, price, changeTodayPct, indicators }) => ({
    secid,
    name,
    price,
    changeTodayPct,
    indicators,
  }));
  const { rows } = await pool.query<Row>(
    'INSERT INTO reviews (model, secids, result, snapshot) VALUES ($1, $2, $3, $4) RETURNING *',
    [config.AI_MODEL, inputs.map((i) => i.secid), result, JSON.stringify(snapshot)],
  );
  res.json(toDto(rows[0]));
});
