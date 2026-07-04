import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';
import { config } from '../config';

export interface RegisterDTO {
  email: string;
  password: string;
  name: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export class AuthService {
  static async register(dto: RegisterDTO) {
    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new AppError('Email already in use', 409, 'CONFLICT');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    return AuthService.generateTokens(user);
  }

  static async login(dto: LoginDTO) {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');

    return AuthService.generateTokens(user);
  }

  static async refresh(refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) throw new AppError('Invalid refresh token', 401, 'INVALID_TOKEN');

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new AppError('Refresh token expired or revoked', 401, 'TOKEN_EXPIRED');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new AppError('User not found', 401, 'UNAUTHORIZED');

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    return AuthService.generateTokens(user);
  }

  static async logout(refreshToken: string): Promise<void> {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }

  static async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });
    if (!user) throw new AppError('User not found', 404, 'NOT_FOUND');
    return user;
  }

  private static async generateTokens(user: { id: string; email: string }) {
    const accessToken = signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = signRefreshToken({ sub: user.id, email: user.email });

    const refreshExpiresMs = parseDurationMs(config.JWT_REFRESH_EXPIRES_IN);
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshExpiresMs),
      },
    });

    return { accessToken, refreshToken };
  }
}

function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, n, unit] = match;
  const num = parseInt(n, 10);
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return num * (multipliers[unit] ?? 86400000);
}
