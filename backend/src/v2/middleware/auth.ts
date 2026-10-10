import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '../types/auth';
import { getJwtSecret } from '../config/authConfig';

export interface AuthedRequest extends Request {
  auth?: AuthTokenPayload;
}

export const authenticateV2 = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' });
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, getJwtSecret()) as AuthTokenPayload;
    req.auth = payload;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing auth context' });
    }
    if (!roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient role' });
    }
    return next();
  };
};
