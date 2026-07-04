import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt';
import { AppError } from './error.middleware';

export interface AuthUser {
  id: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('No token provided', 401, 'UNAUTHORIZED'));
  }

  const token = authHeader.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    return next(new AppError('Invalid or expired token', 401, 'UNAUTHORIZED'));
  }

  req.user = { id: payload.sub, email: payload.email };
  next();
}
