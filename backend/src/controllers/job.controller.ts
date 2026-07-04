import { Request, Response } from 'express';
import { z } from 'zod';
import { JobType } from '@prisma/client';
import { JobService } from '../services/job.service';
import { asyncHandler } from '../utils/asyncHandler';

const CreateJobSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.nativeEnum(JobType).optional(),
  payload: z.record(z.unknown()).default({}),
  priority: z.number().int().default(0),
  runAt: z.string().datetime().optional(),
  cronExpression: z.string().optional(),
  maxAttempts: z.number().int().min(1).max(100).optional(),
  timeout: z.number().int().min(1000).optional(),
  idempotencyKey: z.string().max(255).optional(),
  parentJobId: z.string().uuid().optional(),
});

const CreateBatchSchema = z.object({
  batchName: z.string().min(1).max(200),
  jobs: z.array(CreateJobSchema).min(1).max(1000),
});

export const createJob = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateJobSchema.parse(req.body);
  const job = await JobService.create(req.params.queueId, dto);
  res.status(201).json({ success: true, data: job });
});

export const createBatch = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateBatchSchema.parse(req.body);
  const result = await JobService.createBatch(req.params.queueId, dto);
  res.status(201).json({ success: true, data: result });
});

export const listJobs = asyncHandler(async (req: Request, res: Response) => {
  const result = await JobService.list(req.params.queueId, req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
});

export const getJob = asyncHandler(async (req: Request, res: Response) => {
  const job = await JobService.getById(req.params.jobId);
  res.json({ success: true, data: job });
});

export const cancelJob = asyncHandler(async (req: Request, res: Response) => {
  const job = await JobService.cancel(req.params.jobId);
  res.json({ success: true, data: job });
});

export const retryJob = asyncHandler(async (req: Request, res: Response) => {
  const job = await JobService.retry(req.params.jobId);
  res.json({ success: true, data: job });
});

export const getJobLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await JobService.getLogs(req.params.jobId, req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
});

export const getJobMetrics = asyncHandler(async (req: Request, res: Response) => {
  const metrics = await JobService.getMetrics(req.params.queueId);
  res.json({ success: true, data: metrics });
});
