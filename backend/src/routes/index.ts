import { Router } from 'express';
import authRoutes from './auth.routes';
import orgRoutes from './org.routes';
import projectRoutes from './project.routes';
import queueRoutes from './queue.routes';
import jobRoutes from './job.routes';
import workerRoutes from './worker.routes';
import dlqRoutes from './dlq.routes';
import retryPolicyRoutes from './retryPolicy.routes';
import healthRoutes from './health.routes';
import directJobRoutes from './jobs.direct.routes';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/organizations', orgRoutes);
router.use('/organizations/:orgId/projects', projectRoutes);
router.use('/projects/:projectId/queues', queueRoutes);
router.use('/queues/:queueId/jobs', jobRoutes);
router.use('/workers', workerRoutes);
router.use('/dlq', dlqRoutes);
router.use('/retry-policies', retryPolicyRoutes);
router.use('/jobs', directJobRoutes);

export default router;
