import { Router } from 'express';
import * as queue from '../controllers/queue.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.post('/', queue.createQueue);
router.get('/', queue.listQueues);
router.get('/:queueId', queue.getQueue);
router.patch('/:queueId', queue.updateQueue);
router.delete('/:queueId', queue.deleteQueue);
router.post('/:queueId/pause', queue.pauseQueue);
router.post('/:queueId/resume', queue.resumeQueue);
router.get('/:queueId/stats', queue.getQueueStats);

export default router;
