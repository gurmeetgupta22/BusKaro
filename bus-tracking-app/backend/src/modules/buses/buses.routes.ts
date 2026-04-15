import { Router } from 'express';
import {
    listBuses,
    getBus,
    createBus,
    updateBus,
    deleteBus,
    assignDriver,
} from './buses.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { isAdmin } from '../../middleware/role.middleware';

const router = Router();

/**
 * Publicly accessible routes (for authenticated users)
 */
router.get('/', authenticate, listBuses);
router.get('/:id', authenticate, getBus);

/**
 * Admin-only routes
 */
router.post('/', authenticate, isAdmin, createBus);
router.put('/:id', authenticate, isAdmin, updateBus);
router.delete('/:id', authenticate, isAdmin, deleteBus);
router.post('/:id/assign-driver', authenticate, isAdmin, assignDriver);

export default router;
