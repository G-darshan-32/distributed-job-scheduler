/**
 * Direct job access by ID — bypasses queue-scoped route.
 * Used by the frontend detail page which only knows the job ID.
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { JobService } from '../services/job.service';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
router.use(authenticate);

router.get(
  '/:jobId',
  asyncHandler(async (req: Request, res: Response) => {
    const job = await JobService.getById(req.params.jobId);
    res.json({ success: true, data: job });
  })
);

router.get(
  '/:jobId/logs',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await JobService.getLogs(req.params.jobId, req.query as Record<string, unknown>);
    res.json({ success: true, ...result });
  })
);

router.post(
  '/:jobId/retry',
  asyncHandler(async (req: Request, res: Response) => {
    const job = await JobService.retry(req.params.jobId);
    res.json({ success: true, data: job });
  })
);

router.post(
  '/:jobId/cancel',
  asyncHandler(async (req: Request, res: Response) => {
    const job = await JobService.cancel(req.params.jobId);
    res.json({ success: true, data: job });
  })
);

export default router;
