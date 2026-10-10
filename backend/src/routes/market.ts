import { Router } from 'express';
import { z } from 'zod';
import { CANDLE_INTERVALS, getCandles, getQuote, search } from '../moex.js';

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

export { secidSchema };
