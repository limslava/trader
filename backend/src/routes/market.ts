import { Router } from 'express';
import { z } from 'zod';
import { getMarketContext } from '../context.js';
import { getNewsSafe, MARKET_NEWS_QUERY, newsQueryFor } from '../news.js';
import { FUNDAMENTAL_FIELDS, getCompanyData, isSandbox, tinkoffConfigured } from '../tinkoff.js';
import { CANDLE_INTERVALS, daysAgo, getCandles, getIndexComposition, getQuote, getQuotes, search } from '../moex.js';

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

/** Dividends and fundamentals from T-Invest; `configured: false` when no token is set. */
marketRouter.get('/company/:secid', async (req, res) => {
  const secid = secidSchema.parse(req.params.secid);
  if (!tinkoffConfigured()) return void res.json({ configured: false });
  res.json({ configured: true, sandbox: isSandbox, labels: FUNDAMENTAL_FIELDS, data: await getCompanyData(secid) });
});

/** Last ~30 daily closes per instrument for sparklines; failures yield an empty series, not an error. */
marketRouter.get('/sparklines', async (req, res) => {
  const secids = z
    .string()
    .transform((s) => [...new Set(s.split(',').filter(Boolean))])
    .pipe(z.array(secidSchema).max(60))
    .parse(req.query.secids ?? '');
  const from = daysAgo(45);
  const out: Record<string, number[]> = {};
  for (let i = 0; i < secids.length; i += 6) {
    await Promise.all(
      secids.slice(i, i + 6).map(async (secid) => {
        out[secid] = await getCandles(secid, 24, from)
          .then((c) => c.slice(-30).map((x) => x.close))
          .catch(() => []);
      }),
    );
  }
  res.json(out);
});

export { secidSchema };
