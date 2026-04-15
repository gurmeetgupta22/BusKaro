import { prisma } from '../../config/db';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { CreateBusInput, UpdateBusInput } from './buses.validation';

/**
 * Get all buses
 */
export const getAllBuses = async () => {
    return await prisma.bus.findMany({
        include: {
            driver: {
                select: {
                    id: true,
                    fullName: true,
                    licenseNumber: true,
                },
            },
        },
    });
};

/**
 * Get bus by ID
 */
export const getBusById = async (id: string) => {
    const bus = await prisma.bus.findUnique({
        where: { id },
        include: {
            driver: true,
            route: true,
        },
    });

    if (!bus) {
        throw new ApiError(404, 'Bus not found');
    }

    return bus;
};

/**
 * Create a new bus
 */
export const createBus = async (data: CreateBusInput) => {
    const existingBus = await prisma.bus.findUnique({
        where: { busNumber: data.busNumber },
    });

    if (existingBus) {
        throw new ApiError(400, 'Bus with this number already exists');
    }

    const bus = await prisma.bus.create({
        data: {
            busNumber: data.busNumber,
            routeName: data.routeName,
            capacity: data.capacity,
            status: data.status,
        },
    });

    logger.info(`New bus created: ${bus.busNumber}`);
    return bus;
};

/**
 * Update bus details
 */
export const updateBus = async (id: string, data: UpdateBusInput) => {
    const bus = await prisma.bus.findUnique({
        where: { id },
    });

    if (!bus) {
        throw new ApiError(404, 'Bus not found');
    }

    const updatedBus = await prisma.bus.update({
        where: { id },
        data,
    });

    logger.info(`Bus updated: ${updatedBus.busNumber}`);
    return updatedBus;
};

/**
 * Delete a bus
 */
export const deleteBus = async (id: string) => {
    const bus = await prisma.bus.findUnique({
        where: { id },
    });

    if (!bus) {
        throw new ApiError(404, 'Bus not found');
    }

    await prisma.bus.delete({
        where: { id },
    });

    logger.info(`Bus deleted: ${bus.busNumber}`);
};

/**
 * Assign a driver to a bus
 */
export const assignDriverToBus = async (busId: string, driverId: string) => {
    // Check if bus exists
    const bus = await prisma.bus.findUnique({
        where: { id: busId },
    });

    if (!bus) {
        throw new ApiError(404, 'Bus not found');
    }

    // Check if driver exists
    const driver = await prisma.driver.findUnique({
        where: { id: driverId },
    });

    if (!driver) {
        throw new ApiError(404, 'Driver not found');
    }

    // Check if driver is already assigned to another bus
    const existingAssignment = await prisma.driver.findFirst({
        where: {
            id: driverId,
            assignedBusId: { not: null },
            AND: { assignedBusId: { not: busId } }
        },
    });

    if (existingAssignment) {
        throw new ApiError(400, 'Driver is already assigned to another bus');
    }

    // Check if another driver is already assigned to this bus
    const currentDriver = await prisma.driver.findFirst({
        where: { assignedBusId: busId },
    });

    // Use a transaction for assignment
    return await prisma.$transaction(async (tx: any) => {
        // 1. Unassign current driver from this bus if any
        if (currentDriver) {
            await tx.driver.update({
                where: { id: currentDriver.id },
                data: { assignedBusId: null },
            });
        }

        // 2. Assign new driver to this bus
        const updatedDriver = await tx.driver.update({
            where: { id: driverId },
            data: { assignedBusId: busId },
        });

        logger.info(`Driver ${driverId} assigned to bus ${busId}`);
        return updatedDriver;
    });
};
