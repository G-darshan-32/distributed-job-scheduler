import { Router } from 'express';
import * as dlq from '../controllers/dlq.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', dlq.listDLQ);
router.post('/:dlqId/replay', dlq.replayDLQ);
router.delete('/:dlqId', dlq.deleteDLQ);
router.post('/:dlqId/ai-summary', dlq.generateAiSummary);

export default router;
