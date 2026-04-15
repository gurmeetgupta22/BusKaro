import { Router } from 'express';
import {
    loginController,
    registerStudentController,
    registerDriverController,
    registerAdminController,
    refreshTokenController,
    logoutController,
    changePasswordController,
    getCurrentUserController,
} from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { isAdmin } from '../../middleware/role.middleware';
import { authLimiter } from '../../middleware/rateLimiter';

const router = Router();

/**
 * Public routes
 */
router.post('/login', authLimiter, loginController);
router.post('/register/student', registerStudentController);
router.post('/refresh', refreshTokenController);

/**
 * Protected routes
 */
router.post('/logout', authenticate, logoutController);
router.post('/change-password', authenticate, changePasswordController);
router.get('/me', authenticate, getCurrentUserController);

/**
 * Admin only routes
 */
router.post('/register/driver', authenticate, isAdmin, registerDriverController);
router.post('/register/admin', authenticate, isAdmin, registerAdminController);

export default router;
