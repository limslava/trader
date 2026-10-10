import { Request, Response, NextFunction } from 'express';

const secret = process.env.BROKER_CALLBACK_SECRET;

export const verifyCallbackSecret = (req: Request, res: Response, next: NextFunction) => {
  if (!secret) {
    return res.status(500).json({ error: 'Server Misconfigured', message: 'Callback secret not set' });
  }

  const header = req.header('x-callback-secret');
  if (!header || header !== secret) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid callback secret' });
  }

  return next();
};
