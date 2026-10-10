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
import { analysisRouter } from './routes/analysis.js';
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

  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/market', requireAuth, marketRouter);
  app.use('/api/watchlist', requireAuth, watchlistRouter);
  app.use('/api/analysis', requireAuth, analysisRouter);
  app.use('/api/review', requireAuth, reviewRouter);
  app.use('/api/trading', requireAuth, tradingRouter);
  app.use('/api', (_req, _res) => {
    throw new HttpError(404, 'Not found');
  });

  // In production the backend also serves the built SPA.
  const staticDir = config.STATIC_DIR ?? path.resolve(import.meta.dirname, '../../frontend/dist');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get('/{*path}', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
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
