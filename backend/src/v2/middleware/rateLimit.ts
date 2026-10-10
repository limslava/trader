import { Request, Response, NextFunction } from 'express';

const memory = new Map<string, { count: number; resetAt: number }>();

export const simpleRateLimit = (keyFn: (req: Request) => string, limit: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    const entry = memory.get(key);

    if (!entry || now >= entry.resetAt) {
      memory.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= limit) {
      return res.status(429).json({ error: 'Too Many Requests', message: 'Rate limit exceeded' });
    }

    entry.count += 1;
    return next();
  };
};
