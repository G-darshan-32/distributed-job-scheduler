import { Router } from 'express';
import * as worker from '../controllers/worker.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', worker.listWorkers);
router.get('/metrics', worker.getSystemMetrics);
router.get('/:workerId', worker.getWorker);
router.post('/:workerId/drain', worker.drainWorker);
router.get('/:workerId/heartbeats', worker.getWorkerHeartbeats);

export default router;
