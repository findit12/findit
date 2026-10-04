import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request { userId?: number }

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.header('Authorization')?.replace(/^Bearer\s+/i, '');
  try {
    req.userId = Number(jwt.verify(token ?? '', process.env.JWT_SECRET as string).sub);
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required.' });
  }
}
