import { Router } from 'express';
import { z } from 'zod';
import { getMarketContext } from '../context.js';
import { getNewsSafe, MARKET_NEWS_QUERY, newsQueryFor } from '../news.js';
import { CANDLE_INTERVALS, getCandles, getIndexComposition, getQuote, getQuotes, search } from '../moex.js';

export const marketRouter = Router();

const secidSchema = z
  .string()
  .regex(/^[A-Za-z0-9._-]{1,20}$/)
  .transform((s) => s.toUpperCase());

marketRouter.get('/search', async (req, res) => {
  const q = z.string().max(50).catch('').parse(req.query.q);
  res.json(await search(q));
});

marketRouter.get('/quote/:secid', async (req, res) => {
  res.json(await getQuote(secidSchema.parse(req.params.secid)));
});

marketRouter.get('/candles/:secid', async (req, res) => {
  const secid = secidSchema.parse(req.params.secid);
  const { interval, from } = z
    .object({
      interval: z.coerce
        .number()
        .refine((v): v is (typeof CANDLE_INTERVALS)[number] => (CANDLE_INTERVALS as readonly number[]).includes(v)),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .parse(req.query);
  res.json(await getCandles(secid, interval, from));
});

marketRouter.get('/context', async (_req, res) => {
  res.json(await getMarketContext());
});

/** IMOEX constituents with weights and live quotes. */
marketRouter.get('/imoex', async (_req, res) => {
  const members = await getIndexComposition();
  const quotes = new Map((await getQuotes(members.map((m) => m.secid))).map((q) => [q.secid, q]));
  res.json(members.map((m) => ({ ...m, quote: quotes.get(m.secid) ?? null })));
});

marketRouter.get('/news', async (_req, res) => {
  res.json(await getNewsSafe(MARKET_NEWS_QUERY, 7, 15));
});

marketRouter.get('/news/:secid', async (req, res) => {
  const quote = await getQuote(secidSchema.parse(req.params.secid));
  res.json(await getNewsSafe(newsQueryFor(quote.secid, quote.name), 14, 12));
});

export { secidSchema };
