import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authRateLimiter } from '../middleware/rateLimiter.middleware';

const router = Router();

router.post('/register', authRateLimiter, auth.register);
router.post('/login', authRateLimiter, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);
router.get('/me', authenticate, auth.getProfile);

export default router;
