import { Request, Response } from 'express';
import { DLQService } from '../services/dlq.service';
import { asyncHandler } from '../utils/asyncHandler';

export const listDLQ = asyncHandler(async (req: Request, res: Response) => {
  const result = await DLQService.list(req.query as Record<string, unknown>);
  res.json({ success: true, ...result });
});

export const replayDLQ = asyncHandler(async (req: Request, res: Response) => {
  const job = await DLQService.replay(req.params.dlqId);
  res.json({ success: true, data: job });
});

export const deleteDLQ = asyncHandler(async (req: Request, res: Response) => {
  await DLQService.delete(req.params.dlqId);
  res.json({ success: true, message: 'DLQ entry deleted' });
});

export const generateAiSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await DLQService.generateAiSummary(req.params.dlqId);
  res.json({ success: true, data: { summary } });
});
