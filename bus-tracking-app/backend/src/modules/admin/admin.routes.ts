import { Router } from 'express';
import {
    getDashboardStats,
    listAllStudents,
    updateStudentManagement,
    listAllDrivers,
    getDetailedAttendanceReport,
} from './admin.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { isAdmin } from '../../middleware/role.middleware';

const router = Router();

/**
 * All routes in this module require admin authentication
 */
router.use(authenticate);
router.use(isAdmin);

router.get('/analytics', getDashboardStats);
router.get('/students', listAllStudents);
router.put('/students/:id', updateStudentManagement);
router.get('/drivers', listAllDrivers);
router.get('/reports/attendance', getDetailedAttendanceReport);

export default router;
