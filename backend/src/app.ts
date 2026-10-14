import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { authRouter, requireAuth } from './auth.js';
import { config } from './config.js';
import { pool } from './db.js';
import { HttpError } from './http.js';
import { buildDigest, sendTelegram, telegramConfigured } from './digest.js';
import { analysisRouter } from './routes/analysis.js';
import { arenaRouter } from './routes/arena.js';
import { articleRouter } from './routes/article.js';
import { calendarRouter } from './routes/calendar.js';
import { screenerRouter } from './routes/screener.js';
import { marketRouter } from './routes/market.js';
import { reviewRouter } from './routes/review.js';
import { tradingRouter } from './routes/trading.js';
import { watchlistRouter } from './routes/watchlist.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Liveness must not depend on the DB (a DB blip would get the container restarted); readiness does.
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.get('/ready', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/market', requireAuth, marketRouter);
  app.use('/api/watchlist', requireAuth, watchlistRouter);
  app.use('/api/analysis', requireAuth, analysisRouter);
  app.use('/api/review', requireAuth, reviewRouter);
  app.use('/api/trading', requireAuth, tradingRouter);
  app.use('/api/calendar', requireAuth, calendarRouter);
  app.use('/api/news', requireAuth, articleRouter);
  app.use('/api/screener', requireAuth, screenerRouter);
  app.use('/api/arena', requireAuth, arenaRouter);
  app.get('/api/digest/status', requireAuth, (_req, res) => res.json({ configured: telegramConfigured() }));
  app.get('/api/digest/preview', requireAuth, async (_req, res) => res.json({ text: await buildDigest() }));
  app.post('/api/digest/send', requireAuth, async (_req, res) => {
    await sendTelegram(await buildDigest());
    res.json({ ok: true });
  });
  app.use('/api', (_req, _res) => {
    throw new HttpError(404, 'Not found');
  });

  // In production the backend also serves the built SPA.
  const staticDir = config.STATIC_DIR ?? path.resolve(import.meta.dirname, '../../frontend/dist');
  if (fs.existsSync(staticDir)) {
    // Vite hashes asset names, so they can be cached forever; index.html must always be revalidated.
    app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof HttpError) {
      if (err.status >= 500) console.error(`${req.method} ${req.originalUrl} -> ${err.status}: ${err.message}`);
      res.status(err.status).json({ error: err.message });
    } else if (err instanceof ZodError) {
      res.status(400).json({ error: 'Некорректный запрос', details: err.issues });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  };
  app.use(onError);

  return app;
}
