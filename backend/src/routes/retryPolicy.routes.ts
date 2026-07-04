import { Router } from 'express';
import * as rp from '../controllers/retryPolicy.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/', rp.createPolicy);
router.get('/', rp.listPolicies);
router.get('/:policyId', rp.getPolicy);
router.patch('/:policyId', rp.updatePolicy);
router.delete('/:policyId', rp.deletePolicy);

export default router;
