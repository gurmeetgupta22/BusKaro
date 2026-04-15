import { Router } from 'express';
import {
    getMyProfile,
    updateMyProfile,
    getMyAssignedBus,
} from './drivers.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { isDriver } from '../../middleware/role.middleware';

const router = Router();

/**
 * All routes in this module require driver authentication
 */
router.use(authenticate);
router.use(isDriver);

router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);
router.get('/assigned-bus', getMyAssignedBus);

export default router;
