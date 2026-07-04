import { Router } from 'express';
import * as project from '../controllers/project.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router({ mergeParams: true });
router.use(authenticate);

router.post('/', project.createProject);
router.get('/', project.listProjects);
router.get('/:projectId', project.getProject);
router.patch('/:projectId', project.updateProject);
router.delete('/:projectId', project.deleteProject);

export default router;
