import { Router } from 'express';
import * as job from '../controllers/job.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.post('/', job.createJob);
router.post('/batch', job.createBatch);
router.get('/', job.listJobs);
router.get('/metrics', job.getJobMetrics);
router.get('/:jobId', job.getJob);
router.post('/:jobId/cancel', job.cancelJob);
router.post('/:jobId/retry', job.retryJob);
router.get('/:jobId/logs', job.getJobLogs);

export default router;
