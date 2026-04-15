import { Router } from 'express';
import {
    initiatePayment,
    verifyPayment,
    getHistory,
} from './payments.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { isStudent } from '../../middleware/role.middleware';
import { paymentLimiter } from '../../middleware/rateLimiter';

const router = Router();

/**
 * All routes in this module require student authentication
 */
router.use(authenticate);
router.use(isStudent);

router.post('/initiate', paymentLimiter, initiatePayment);
router.post('/verify', verifyPayment);
router.get('/history', getHistory);

export default router;
