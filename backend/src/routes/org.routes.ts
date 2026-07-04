import { Router } from 'express';
import * as org from '../controllers/org.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post('/', org.createOrg);
router.get('/', org.listOrgs);
router.get('/:orgId', org.getOrg);
router.post('/:orgId/members', requireRole(Role.ADMIN), org.addMember);
router.delete('/:orgId/members/:userId', requireRole(Role.ADMIN), org.removeMember);

export default router;
