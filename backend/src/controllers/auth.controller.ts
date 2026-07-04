import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../utils/asyncHandler';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const dto = RegisterSchema.parse(req.body);
  const tokens = await AuthService.register(dto);
  res.status(201).json({ success: true, data: tokens });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const dto = LoginSchema.parse(req.body);
  const tokens = await AuthService.login(dto);
  res.json({ success: true, data: tokens });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = RefreshSchema.parse(req.body);
  const tokens = await AuthService.refresh(refreshToken);
  res.json({ success: true, data: tokens });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = RefreshSchema.parse(req.body);
  await AuthService.logout(refreshToken);
  res.json({ success: true, message: 'Logged out successfully' });
});

export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await AuthService.getProfile(req.user!.id);
  res.json({ success: true, data: user });
});
