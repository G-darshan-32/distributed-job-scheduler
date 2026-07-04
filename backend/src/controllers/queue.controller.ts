import { Request, Response } from 'express';
import { z } from 'zod';
import { QueueService } from '../services/queue.service';
import { asyncHandler } from '../utils/asyncHandler';

const CreateQueueSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  priority: z.number().int().default(0),
  concurrencyLimit: z.number().int().min(1).max(1000).default(10),
  retryPolicyId: z.string().uuid().optional(),
  rateLimitPerMin: z.number().int().min(1).optional(),
  jobTimeout: z.number().int().min(1000).default(300000),
});

export const createQueue = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateQueueSchema.parse(req.body);
  const queue = await QueueService.create(req.params.projectId, dto);
  res.status(201).json({ success: true, data: queue });
});

export const listQueues = asyncHandler(async (req: Request, res: Response) => {
  const result = await QueueService.list(req.params.projectId, req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
});

export const getQueue = asyncHandler(async (req: Request, res: Response) => {
  const queue = await QueueService.getById(req.params.queueId);
  res.json({ success: true, data: queue });
});

export const updateQueue = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateQueueSchema.partial().extend({ isPaused: z.boolean().optional() }).parse(req.body);
  const queue = await QueueService.update(req.params.queueId, dto);
  res.json({ success: true, data: queue });
});

export const pauseQueue = asyncHandler(async (req: Request, res: Response) => {
  const queue = await QueueService.pause(req.params.queueId);
  res.json({ success: true, data: queue });
});

export const resumeQueue = asyncHandler(async (req: Request, res: Response) => {
  const queue = await QueueService.resume(req.params.queueId);
  res.json({ success: true, data: queue });
});

export const deleteQueue = asyncHandler(async (req: Request, res: Response) => {
  await QueueService.delete(req.params.queueId);
  res.json({ success: true, message: 'Queue deleted' });
});

export const getQueueStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await QueueService.getStats(req.params.queueId);
  res.json({ success: true, data: stats });
});
