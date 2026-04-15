import { Socket } from 'socket.io';
import { getIO, emitBusLocationUpdate, emitPickupReached } from '../config/socket';
import { logger } from '../utils/logger';
import { prisma } from '../config/db';
import { cacheBusLocation, getCachedBusLocation } from '../config/redis';
import { detectLocationSpoof, calculateDistance } from '../utils/geoUtils';
import { config } from '../config/env';

// In-memory fallback cache: busId -> { lat, lng, timestamp }
// Used when Redis is disabled for spoof detection
const inMemoryBusLocations: Map<string, { lat: number; lng: number; timestamp: Date }> = new Map();

// Track which driverSocket -> busId for disconnect broadcast
const activeDriverBusMap: Map<string, { busId: string; busNumber: string; routeName: string; lat: number; lng: number }> = new Map();

// How long (ms) a bus location stays visible after driver disconnects (2 minutes)
const OFFLINE_VISIBLE_MS = 2 * 60 * 1000;

/**
 * Initialize tracking socket handlers
 */
export const initializeTrackingSocket = (socket: Socket) => {
    const user = socket.data.user;

    /**
     * Driver sends location update
     * Event: driver:location-update
     */
    socket.on('driver:location-update', async (data: {
        busId?: string;
        lat: number;
        lng: number;
        speed?: number;
        accuracy?: number;
    }) => {
        try {
            if (user.role !== 'DRIVER') {
                socket.emit('error', { message: 'Only drivers can send location updates' });
                return;
            }

            const { lat, lng, speed, accuracy } = data;
            let { busId } = data;

            // Validate coordinates
            if (lat == null || lng == null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                logger.warn(`Driver ${user.userId} sent invalid coordinates: lat=${lat}, lng=${lng}`);
                socket.emit('error', { message: 'Invalid coordinates' });
                return;
            }

            // Get driver + assigned bus
            const driver = await prisma.driver.findUnique({
                where: { userId: user.userId },
                include: { assignedBus: true },
            });

            if (!driver) {
                logger.error(`Driver record not found for userId: ${user.userId}`);
                socket.emit('error', { message: 'Driver profile not found' });
                return;
            }

            if (!driver.assignedBus) {
                logger.warn(`Driver ${driver.fullName} has no assigned bus — cannot track`);
                socket.emit('error', { message: 'No bus assigned. Contact admin.' });
                return;
            }

            // Always use driver's actual assigned bus (ignore busId from client if wrong)
            busId = driver.assignedBusId!;

            logger.info(`📍 Location update from Driver ${driver.fullName} | Bus ${driver.assignedBus.busNumber} | (${lat}, ${lng})`);

            // Spoof detection (non-blocking — Redis or in-memory fallback)
            let lastLocation: { lat: number; lng: number; timestamp: Date } | null = null;
            try {
                lastLocation = await getCachedBusLocation(busId);
            } catch (_) { }
            if (!lastLocation) {
                lastLocation = inMemoryBusLocations.get(busId) || null;
            }

            if (lastLocation) {
                const isSpoofed = detectLocationSpoof(
                    lastLocation.lat, lastLocation.lng, lastLocation.timestamp,
                    lat, lng, new Date(),
                    config.geo.maxRealisticSpeedKmh
                );
                if (isSpoofed) {
                    logger.warn(`⚠ Possible location spoof for bus ${busId}`);
                    socket.emit('warning', { message: 'Suspicious location detected' });
                }
            }

            const timestamp = new Date();

            // Update in-memory cache first (always works)
            inMemoryBusLocations.set(busId, { lat, lng, timestamp });

            // Register driver in active map (for disconnect broadcast)
            activeDriverBusMap.set(socket.id, {
                busId,
                busNumber: driver.assignedBus.busNumber,
                routeName: driver.assignedBus.routeName,
                lat,
                lng,
            });

            // Try Redis cache (non-blocking)
            cacheBusLocation(busId, { lat, lng, timestamp }).catch(() => { });

            // Persist to DB
            await prisma.bus.update({
                where: { id: busId },
                data: { currentLat: lat, currentLng: lng, lastLocationUpdate: timestamp },
            });

            await prisma.locationHistory.create({
                data: { busId, lat, lng, speed, accuracy, timestamp },
            });

            // Update active map with latest location
            activeDriverBusMap.set(socket.id, {
                busId,
                busNumber: driver.assignedBus.busNumber,
                routeName: driver.assignedBus.routeName,
                lat,
                lng,
            });

            // Broadcast to ALL students and admins immediately
            emitBusLocationUpdate({
                busId,
                busNumber: driver.assignedBus.busNumber,
                routeName: driver.assignedBus.routeName,
                lat,
                lng,
                timestamp,
                isLive: true,
            });

            // Proximity detection: notify students whose pickup is within 150m
            const activePickups = await prisma.pickupPin.findMany({
                where: { status: 'ACTIVE' },
                include: { student: { include: { user: true } } },
            });

            for (const pickup of activePickups) {
                const distance = calculateDistance(lat, lng, pickup.lat, pickup.lng);
                if (distance <= 150) {
                    emitPickupReached(pickup.student.user.id, {
                        pickupId: pickup.id,
                        busNumber: driver.assignedBus.busNumber,
                    });
                }
            }

        } catch (error) {
            logger.error('❌ Error in driver:location-update:', error);
            socket.emit('error', { message: 'Failed to update location' });
        }
    });

    /**
     * Student requests current bus locations
     * Event: student:request-buses
     *
     * Returns buses updated within the last 2 minutes (driver is considered "recently active").
     * If no buses have recent updates, also returns any bus with a location to show "last known position".
     */
    socket.on('student:request-buses', async () => {
        try {
            const twoMinutesAgo = new Date(Date.now() - OFFLINE_VISIBLE_MS);

            // PRIMARY: buses updated in the last 2 minutes (live/recently offline)
            const recentBuses = await prisma.bus.findMany({
                where: {
                    status: 'ACTIVE',
                    currentLat: { not: null },
                    currentLng: { not: null },
                    lastLocationUpdate: { gte: twoMinutesAgo },
                },
                select: {
                    id: true,
                    busNumber: true,
                    routeName: true,
                    currentLat: true,
                    currentLng: true,
                    lastLocationUpdate: true,
                },
            });

            // FALLBACK: if no recent buses, return ANY bus with a stored location
            // so students can see the last known position with an "offline" indicator
            let buses = recentBuses;
            if (buses.length === 0) {
                buses = await prisma.bus.findMany({
                    where: {
                        status: 'ACTIVE',
                        currentLat: { not: null },
                        currentLng: { not: null },
                    },
                    select: {
                        id: true,
                        busNumber: true,
                        routeName: true,
                        currentLat: true,
                        currentLng: true,
                        lastLocationUpdate: true,
                    },
                });
                if (buses.length > 0) {
                    logger.info(`No recent buses — returning ${buses.length} bus(es) with last known location`);
                }
            }

            logger.info(`Student ${user.email} → buses: ${buses.length} (${recentBuses.length} live)`);

            const now = Date.now();
            socket.emit('buses:list', {
                buses: buses.map(bus => {
                    const lastUpdateMs = bus.lastLocationUpdate
                        ? now - new Date(bus.lastLocationUpdate).getTime()
                        : Infinity;
                    return {
                        busId: bus.id,
                        busNumber: bus.busNumber,
                        routeName: bus.routeName,
                        lat: bus.currentLat,
                        lng: bus.currentLng,
                        lastUpdate: bus.lastLocationUpdate,
                        // Live = updated within last 30 seconds
                        isLive: lastUpdateMs < 30 * 1000,
                        // Show "offline but recent" if within 2 minutes
                        isOfflineRecent: lastUpdateMs >= 30 * 1000 && lastUpdateMs < OFFLINE_VISIBLE_MS,
                    };
                }),
            });
        } catch (error) {
            logger.error('Error fetching buses:', error);
            socket.emit('error', { message: 'Failed to fetch buses' });
        }
    });

    /**
     * Handle driver disconnect: broadcast last known location to students
     * Students see the bus marker with "offline" state for 2 minutes
     */
    socket.on('disconnect', async () => {
        if (user.role !== 'DRIVER') return;

        const busInfo = activeDriverBusMap.get(socket.id);
        if (!busInfo) {
            logger.info(`Driver ${user.userId} disconnected (no active location recorded)`);
            return;
        }

        activeDriverBusMap.delete(socket.id);

        try {
            const io = getIO();
            io.to('STUDENT').emit('bus:offline', {
                busId: busInfo.busId,
                busNumber: busInfo.busNumber,
                routeName: busInfo.routeName,
                lat: busInfo.lat,
                lng: busInfo.lng,
                lastUpdate: new Date().toISOString(),
                isLive: false,
                isOfflineRecent: true,
            });

            logger.info(`🔴 Driver disconnected → Bus ${busInfo.busNumber} marked offline. Last location broadcast to students.`);

            // After 2 minutes, broadcast removal so students stop seeing the marker
            setTimeout(async () => {
                try {
                    const io2 = getIO();
                    io2.to('STUDENT').emit('bus:removed', { busId: busInfo.busId });
                    logger.info(`🗑 Bus ${busInfo.busNumber} removed from student map (2-min timeout expired)`);
                } catch (_) { }
            }, OFFLINE_VISIBLE_MS);

        } catch (error) {
            logger.error('Error on driver disconnect:', error);
        }
    });

    /**
     * Admin requests all tracking data
     */
    socket.on('admin:request-tracking', async () => {
        try {
            if (user.role !== 'ADMIN') {
                socket.emit('error', { message: 'Unauthorized' });
                return;
            }

            const buses = await prisma.bus.findMany({
                include: {
                    driver: { select: { id: true, fullName: true, phoneNumber: true } },
                },
            });

            const pickups = await prisma.pickupPin.findMany({
                where: { status: 'ACTIVE' },
                include: {
                    student: { select: { fullName: true, rollNumber: true, phoneNumber: true } },
                },
            });

            socket.emit('admin:tracking-data', {
                buses: buses.map(bus => ({
                    id: bus.id,
                    busNumber: bus.busNumber,
                    routeName: bus.routeName,
                    status: bus.status,
                    currentLat: bus.currentLat,
                    currentLng: bus.currentLng,
                    lastLocationUpdate: bus.lastLocationUpdate,
                    driver: bus.driver,
                })),
                pickups: pickups.map(pickup => ({
                    id: pickup.id,
                    lat: pickup.lat,
                    lng: pickup.lng,
                    student: pickup.student,
                    createdAt: pickup.createdAt,
                    expiresAt: pickup.expiresAt,
                })),
            });
        } catch (error) {
            logger.error('Error fetching tracking data:', error);
            socket.emit('error', { message: 'Failed to fetch tracking data' });
        }
    });
};

export { activeDriverBusMap };
