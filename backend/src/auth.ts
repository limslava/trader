import crypto from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config, isProd } from './config.js';
import { HttpError } from './http.js';

const COOKIE = 'trader_session';
const SESSION_DAYS = 30;

function passwordMatches(input: string): boolean {
  // Compare fixed-length digests so timingSafeEqual works regardless of input length.
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(config.APP_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

// Simple brute-force guard: max 10 failed attempts per IP per 15 minutes.
const failures = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string) {
  const entry = failures.get(ip);
  if (entry && entry.resetAt > Date.now() && entry.count >= 10) {
    throw new HttpError(429, 'Слишком много попыток входа, попробуйте позже');
  }
}
function recordFailure(ip: string) {
  // Keep the map bounded: drop expired buckets whenever we touch it.
  for (const [k, v] of failures) if (v.resetAt <= Date.now()) failures.delete(k);
  const entry = failures.get(ip);
  if (!entry || entry.resetAt <= Date.now()) failures.set(ip, { count: 1, resetAt: Date.now() + 15 * 60_000 });
  else entry.count++;
}

/** Derived from the password too, so changing APP_PASSWORD logs every device out. */
function sessionSecret(): string {
  return crypto.createHmac('sha256', config.JWT_SECRET).update(config.APP_PASSWORD).digest('hex');
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Требуется вход');
  try {
    jwt.verify(token, sessionSecret(), { algorithms: ['HS256'] });
  } catch {
    throw new HttpError(401, 'Сессия истекла, войдите снова');
  }
  next();
};

export const authRouter = Router();

authRouter.post('/login', (req, res) => {
  const ip = req.ip ?? 'unknown';
  checkRateLimit(ip);
  const { password } = z.object({ password: z.string() }).parse(req.body);
  if (!passwordMatches(password)) {
    recordFailure(ip);
    throw new HttpError(401, 'Неверный пароль');
  }
  failures.delete(ip);
  const token = jwt.sign({ sub: 'owner' }, sessionSecret(), { algorithm: 'HS256', expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_DAYS * 86_400_000,
  });
  res.json({ ok: true });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (_req, res) => {
  res.json({ ok: true });
});
