import { Request, Response } from 'express';
import { z } from 'zod';
import { RetryStrategy } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../middleware/error.middleware';

const Schema = z.object({
  name: z.string().min(1).max(100),
  strategy: z.nativeEnum(RetryStrategy).default(RetryStrategy.EXPONENTIAL),
  maxAttempts: z.number().int().min(1).max(100).default(3),
  baseDelayMs: z.number().int().min(100).default(1000),
  maxDelayMs: z.number().int().min(100).default(3600000),
  multiplier: z.number().min(1).max(10).default(2.0),
});

export const createPolicy = asyncHandler(async (req: Request, res: Response) => {
  const data = Schema.parse(req.body);
  const policy = await prisma.retryPolicy.create({ data });
  res.status(201).json({ success: true, data: policy });
});

export const listPolicies = asyncHandler(async (_req: Request, res: Response) => {
  const policies = await prisma.retryPolicy.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ success: true, data: policies });
});

export const getPolicy = asyncHandler(async (req: Request, res: Response) => {
  const policy = await prisma.retryPolicy.findUnique({ where: { id: req.params.policyId } });
  if (!policy) throw new AppError('Retry policy not found', 404, 'NOT_FOUND');
  res.json({ success: true, data: policy });
});

export const updatePolicy = asyncHandler(async (req: Request, res: Response) => {
  const policy = await prisma.retryPolicy.findUnique({ where: { id: req.params.policyId } });
  if (!policy) throw new AppError('Retry policy not found', 404, 'NOT_FOUND');
  const data = Schema.partial().parse(req.body);
  const updated = await prisma.retryPolicy.update({ where: { id: req.params.policyId }, data });
  res.json({ success: true, data: updated });
});

export const deletePolicy = asyncHandler(async (req: Request, res: Response) => {
  const policy = await prisma.retryPolicy.findUnique({ where: { id: req.params.policyId } });
  if (!policy) throw new AppError('Retry policy not found', 404, 'NOT_FOUND');
  await prisma.retryPolicy.delete({ where: { id: req.params.policyId } });
  res.json({ success: true, message: 'Policy deleted' });
});
