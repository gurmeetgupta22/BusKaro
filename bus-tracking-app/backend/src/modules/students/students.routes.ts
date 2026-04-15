import { Router } from 'express';
import {
    getMyProfile,
    updateMyProfile,
    getMyFeeStatus,
    getMyHistory,
    reportIssue,
} from './students.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { isStudent } from '../../middleware/role.middleware';

const router = Router();

/**
 * All routes in this module require student authentication
 */
router.use(authenticate);
router.use(isStudent);

router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);
router.get('/fee-status', getMyFeeStatus);
router.get('/history', getMyHistory);
router.post('/report-issue', reportIssue);

export default router;
