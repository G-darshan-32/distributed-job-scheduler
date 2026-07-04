import { Request, Response } from 'express';
import { WorkerService } from '../services/worker.service';
import { asyncHandler } from '../utils/asyncHandler';

export const listWorkers = asyncHandler(async (_req: Request, res: Response) => {
  const workers = await WorkerService.list();
  res.json({ success: true, data: workers });
});

export const getWorker = asyncHandler(async (req: Request, res: Response) => {
  const worker = await WorkerService.getById(req.params.workerId);
  res.json({ success: true, data: worker });
});

export const drainWorker = asyncHandler(async (req: Request, res: Response) => {
  const worker = await WorkerService.drain(req.params.workerId);
  res.json({ success: true, data: worker });
});

export const getWorkerHeartbeats = asyncHandler(async (req: Request, res: Response) => {
  const minutes = parseInt(String(req.query.minutes ?? '60'), 10);
  const heartbeats = await WorkerService.getHeartbeats(req.params.workerId, minutes);
  res.json({ success: true, data: heartbeats });
});

export const getSystemMetrics = asyncHandler(async (_req: Request, res: Response) => {
  const metrics = await WorkerService.getSystemMetrics();
  res.json({ success: true, data: metrics });
});
