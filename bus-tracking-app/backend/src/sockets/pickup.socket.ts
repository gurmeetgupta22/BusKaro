import { Socket } from 'socket.io';
import { logger } from '../utils/logger';
import { prisma } from '../config/db';
import { getIO, emitPickupRequest, emitPickupConfirmation, emitPickupCancellation, emitPickupPicked } from '../config/socket';
import { config } from '../config/env';
import { isWithinRadius, calculateETA, calculateDistance } from '../utils/geoUtils';

/**
 * Initialize pickup socket handlers
 */
export const initializePickupSocket = (socket: Socket) => {
    const user = socket.data.user;

    /**
     * Student creates pickup pin
     * Event: student:pin-location
     */
    socket.on('student:pin-location', async (data: {
        lat: number;
        lng: number;
        address?: string;
    }) => {
        try {
            // Verify user is a student
            if (user.role !== 'STUDENT') {
                socket.emit('error', { message: 'Only students can create pickup pins' });
                return;
            }

            const { lat, lng, address } = data;

            // Validate coordinates
            if (!lat || !lng || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                socket.emit('error', { message: 'Invalid coordinates' });
                return;
            }

            // Get student info
            const student = await prisma.student.findUnique({
                where: { userId: user.userId },
            });

            if (!student) {
                socket.emit('error', { message: 'Student not found' });
                return;
            }

            // Check fee status
            if (student.feeStatus !== 'PAID') {
                socket.emit('error', {
                    message: 'Cannot create pickup pin. Please pay your fees first.',
                    feeStatus: student.feeStatus,
                });
                return;
            }

            // Check if student already has an active pickup pin
            const existingPin = await prisma.pickupPin.findFirst({
                where: {
                    studentId: student.id,
                    status: 'ACTIVE',
                },
            });

            if (existingPin) {
                socket.emit('error', { message: 'You already have an active pickup pin' });
                return;
            }

            // Create pickup pin
            const expiresAt = new Date(
                Date.now() + config.geo.pickupPinExpiryMinutes * 60 * 1000
            );

            const pickupPin = await prisma.pickupPin.create({
                data: {
                    studentId: student.id,
                    lat,
                    lng,
                    address,
                    status: 'ACTIVE',
                    expiresAt,
                },
            });

            // Find nearest bus and notify driver
            const nearbyBuses = await prisma.bus.findMany({
                where: {
                    status: 'ACTIVE',
                    currentLat: { not: null },
                    currentLng: { not: null },
                },
                include: {
                    driver: true,
                },
            });

            // Calculate distances and find nearest bus
            let nearestBus = null;
            let minDistance = Infinity;

            for (const bus of nearbyBuses) {
                if (bus.currentLat && bus.currentLng) {
                    const distance = calculateDistance(
                        lat,
                        lng,
                        bus.currentLat,
                        bus.currentLng
                    );

                    if (distance < minDistance && distance <= config.geo.maxPickupRadiusMeters) {
                        minDistance = distance;
                        nearestBus = bus;
                    }
                }
            }

            const pickupResponse = {
                id: pickupPin.id, // Standardize on 'id' for Redux
                pickupId: pickupPin.id,
                status: 'ACTIVE',
                lat: pickupPin.lat,
                lng: pickupPin.lng,
                address: pickupPin.address,
                student: {
                    id: student.id,
                    name: student.fullName,
                    rollNumber: student.rollNumber,
                    phoneNumber: student.phoneNumber,
                    feeStatus: student.feeStatus,
                },
                feeStatus: student.feeStatus,
                createdAt: pickupPin.createdAt,
                expiresAt: pickupPin.expiresAt,
            };

            // Notify ALL drivers so they see the marker immediately
            const io = getIO();
            io.to('DRIVER').emit('pickup:new', pickupResponse);

            if (nearestBus && nearestBus.driver) {
                // Calculate and send ETA to student
                const eta = calculateETA(minDistance);
                socket.emit('pickup:confirmed', {
                    ...pickupResponse,
                    eta,
                    busNumber: nearestBus.busNumber,
                    distance: minDistance,
                });
            } else {
                // No nearby bus found but pin is still active
                socket.emit('pickup:confirmed', {
                    ...pickupResponse,
                    message: 'No buses nearby. You will be notified when a bus approaches.',
                });
            }

            logger.info(`Pickup pin created by student ${student.rollNumber} at (${lat}, ${lng})`);
        } catch (error) {
            logger.error('Error creating pickup pin:', error);
            socket.emit('error', { message: 'Failed to create pickup pin' });
        }
    });

    /**
     * Student cancels pickup pin
     * Event: student:cancel-pin
     */
    socket.on('student:cancel-pin', async (data: { pickupId: string }) => {
        try {
            if (user.role !== 'STUDENT') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            const { pickupId } = data;

            // Get student
            const student = await prisma.student.findUnique({
                where: { userId: user.userId },
            });

            if (!student) {
                socket.emit('error', { message: 'Student not found' });
                return;
            }

            // Find and verify pickup pin
            const pickupPin = await prisma.pickupPin.findFirst({
                where: {
                    id: pickupId,
                    studentId: student.id,
                    status: 'ACTIVE',
                },
            });

            if (!pickupPin) {
                socket.emit('error', { message: 'Pickup pin not found or already cancelled' });
                return;
            }

            // Update status to cancelled
            await prisma.pickupPin.update({
                where: { id: pickupId },
                data: { status: 'CANCELLED' },
            });

            // Find nearby bus and notify driver
            const nearbyBuses = await prisma.bus.findMany({
                where: {
                    status: 'ACTIVE',
                    currentLat: { not: null },
                    currentLng: { not: null },
                },
                include: { driver: true },
            });

            for (const bus of nearbyBuses) {
                if (bus.currentLat && bus.currentLng && bus.driver) {
                    const distance = calculateDistance(
                        pickupPin.lat,
                        pickupPin.lng,
                        bus.currentLat,
                        bus.currentLng
                    );

                    if (distance <= config.geo.maxPickupRadiusMeters) {
                        emitPickupCancellation(bus.driver.userId, {
                            pickupId: pickupPin.id,
                            studentId: student.id,
                        });
                    }
                }
            }

            socket.emit('pickup:cancelled', { pickupId });
            logger.info(`Pickup pin ${pickupId} cancelled by student ${student.rollNumber}`);
        } catch (error) {
            logger.error('Error cancelling pickup pin:', error);
            socket.emit('error', { message: 'Failed to cancel pickup pin' });
        }
    });

    /**
     * Driver marks pickup as complete
     * Event: driver:pickup-complete
     */
    socket.on('driver:pickup-complete', async (data: { pickupId: string }) => {
        try {
            if (user.role !== 'DRIVER') {
                socket.emit('error', { message: 'Only drivers can complete pickups' });
                return;
            }

            const { pickupId } = data;

            // Get driver
            const driver = await prisma.driver.findUnique({
                where: { userId: user.userId },
                include: { assignedBus: true },
            });

            if (!driver || !driver.assignedBus) {
                socket.emit('error', { message: 'Driver not assigned to any bus' });
                return;
            }

            // Find pickup pin
            const pickupPin = await prisma.pickupPin.findUnique({
                where: { id: pickupId },
                include: { student: true },
            });

            if (!pickupPin) {
                socket.emit('error', { message: 'Pickup pin not found' });
                return;
            }

            if (pickupPin.status !== 'ACTIVE') {
                socket.emit('error', { message: 'Pickup pin is not active' });
                return;
            }

            // Update pickup status
            await prisma.pickupPin.update({
                where: { id: pickupId },
                data: {
                    status: 'PICKED',
                    pickedAt: new Date(),
                },
            });

            // Record attendance
            await prisma.attendance.create({
                data: {
                    studentId: pickupPin.studentId,
                    busId: driver.assignedBusId!,
                    boardedAt: new Date(),
                    boardingLat: pickupPin.lat,
                    boardingLng: pickupPin.lng,
                },
            });

            // Notify student
            emitPickupPicked(pickupPin.student.userId, {
                pickupId: pickupPin.id,
            });

            // Notify ALL drivers to remove this pin
            const io = getIO();
            io.emit('pickup:completed', { pickupId });

            logger.info(`Pickup ${pickupId} completed by driver ${driver.fullName}`);
        } catch (error) {
            logger.error('Error completing pickup:', error);
            socket.emit('error', { message: 'Failed to complete pickup' });
        }
    });

    /**
     * Driver requests active pickups
     * Event: driver:request-pickups
     */
    socket.on('driver:request-pickups', async () => {
        try {
            if (user.role !== 'DRIVER') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            // Get all active pickup pins
            const allPickups = await prisma.pickupPin.findMany({
                where: { status: 'ACTIVE' },
                include: {
                    student: {
                        select: {
                            id: true,
                            fullName: true,
                            rollNumber: true,
                            phoneNumber: true,
                            feeStatus: true,
                        },
                    },
                },
            });

            const nearbyPickups = allPickups
                .map(pickup => ({
                    id: pickup.id,
                    lat: pickup.lat,
                    lng: pickup.lng,
                    address: pickup.address,
                    student: {
                        id: pickup.student.id,
                        name: pickup.student.fullName,
                        rollNumber: pickup.student.rollNumber,
                        phoneNumber: pickup.student.phoneNumber,
                        feeStatus: pickup.student.feeStatus,
                    },
                    feeStatus: pickup.student.feeStatus,
                    createdAt: pickup.createdAt,
                    expiresAt: pickup.expiresAt,
                }))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            socket.emit('driver:pickups', { pickups: nearbyPickups });
        } catch (error) {
            logger.error('Error fetching pickups:', error);
            socket.emit('error', { message: 'Failed to fetch pickups' });
        }
    });
};
