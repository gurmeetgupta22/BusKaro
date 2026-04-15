import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import * as driversService from './drivers.service';
import { updateDriverSchema } from './drivers.validation';

/**
 * Get current driver profile
 * GET /api/drivers/profile
 */
export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const profile = await driversService.getDriverProfile(userId);

    res.status(200).json({
        success: true,
        data: profile,
    });
});

/**
 * Update current driver profile
 * PUT /api/drivers/profile
 */
export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const validatedData = updateDriverSchema.parse(req.body);

    const updatedProfile = await driversService.updateDriverProfile(userId, validatedData);

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
    });
});

/**
 * Get current driver's assigned bus
 * GET /api/drivers/assigned-bus
 */
export const getMyAssignedBus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const assignedBus = await driversService.getAssignedBus(userId);

    res.status(200).json({
        success: true,
        data: assignedBus,
    });
});
