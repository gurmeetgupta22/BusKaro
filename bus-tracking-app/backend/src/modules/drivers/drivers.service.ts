import { prisma } from '../../config/db';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { UpdateDriverInput } from './drivers.validation';

/**
 * Get driver profile by user ID
 */
export const getDriverProfile = async (userId: string) => {
    const driver = await prisma.driver.findUnique({
        where: { userId },
        include: {
            user: {
                select: {
                    email: true,
                    isActive: true,
                    lastLogin: true,
                },
            },
            assignedBus: true,
        },
    });

    if (!driver) {
        throw new ApiError(404, 'Driver profile not found');
    }

    return driver;
};

/**
 * Update driver profile
 */
export const updateDriverProfile = async (userId: string, data: UpdateDriverInput) => {
    const driver = await prisma.driver.findUnique({
        where: { userId },
    });

    if (!driver) {
        throw new ApiError(404, 'Driver profile not found');
    }

    const updatedDriver = await prisma.driver.update({
        where: { userId },
        data,
    });

    logger.info(`Driver profile updated for userId: ${userId}`);
    return updatedDriver;
};

/**
 * Get details of the bus assigned to the driver
 */
export const getAssignedBus = async (userId: string) => {
    const driver = await prisma.driver.findUnique({
        where: { userId },
        include: {
            assignedBus: {
                include: {
                    route: true,
                },
            },
        },
    });

    if (!driver) {
        throw new ApiError(404, 'Driver profile not found');
    }

    if (!driver.assignedBus) {
        throw new ApiError(404, 'No bus assigned to this driver');
    }

    return driver.assignedBus;
};
