import { Router } from 'express';
import { pool } from '../db.js';
import { getQuote, getQuotes } from '../moex.js';
import { secidSchema } from './market.js';

export const watchlistRouter = Router();

/** Watchlist items enriched with live quotes and the latest AI signal. */
watchlistRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<{
    secid: string;
    shortname: string;
    signal: string | null;
    confidence: string | null;
    analyzed_at: Date | null;
  }>(`
    SELECT w.secid, w.shortname, a.signal, a.confidence, a.created_at AS analyzed_at
    FROM watchlist w
    LEFT JOIN LATERAL (
      SELECT signal, confidence, created_at FROM analyses
      WHERE analyses.secid = w.secid ORDER BY created_at DESC LIMIT 1
    ) a ON true
    ORDER BY w.added_at`);

  const quotes = new Map((await getQuotes(rows.map((r) => r.secid))).map((q) => [q.secid, q]));
  res.json(
    rows.map((r) => ({
      secid: r.secid,
      shortname: r.shortname,
      quote: quotes.get(r.secid) ?? null,
      lastAnalysis: r.signal
        ? { signal: r.signal, confidence: Number(r.confidence), createdAt: r.analyzed_at }
        : null,
    })),
  );
});

watchlistRouter.put('/:secid', async (req, res) => {
  const quote = await getQuote(secidSchema.parse(req.params.secid));
  await pool.query(
    'INSERT INTO watchlist (secid, shortname) VALUES ($1, $2) ON CONFLICT (secid) DO NOTHING',
    [quote.secid, quote.shortname],
  );
  res.json({ ok: true });
});

watchlistRouter.delete('/:secid', async (req, res) => {
  await pool.query('DELETE FROM watchlist WHERE secid = $1', [secidSchema.parse(req.params.secid)]);
  res.json({ ok: true });
});
