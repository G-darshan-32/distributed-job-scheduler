import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  sub: string;       // userId
  email: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function signRefreshToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
