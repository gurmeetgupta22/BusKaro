import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from './env';
import { logger } from '../utils/logger';
import { verifyToken } from '../utils/tokenUtils';
// import { initializeTrackingSocket } from '../sockets/tracking.socket'; // Moved to inside function to avoid circular dependency
// import { initializePickupSocket } from '../sockets/pickup.socket'; // Moved to inside function to avoid circular dependency

let io: Server;

export const initializeSocket = (server: HTTPServer): Server => {
    io = new Server(server, {
        cors: {
            origin: config.corsOrigin,
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // Authentication middleware
    io.use(async (socket: Socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error('Authentication token required'));
            }

            const decoded = verifyToken(token, config.jwt.accessSecret);
            socket.data.user = decoded;

            logger.info(`Socket authenticated: ${decoded.userId} (${decoded.role})`);
            next();
        } catch (error) {
            logger.error('Socket authentication failed:', error);
            next(new Error('Authentication failed'));
        }
    });

    // Connection handler
    io.on('connection', (socket: Socket) => {
        const user = socket.data.user;
        logger.info(`Client connected: ${socket.id} - User: ${user.userId} (${user.role})`);

        // Join role-based room (consistent with role names like 'STUDENT', 'DRIVER')
        socket.join(user.role);

        // Join user-specific room
        socket.join(`user:${user.userId}`);

        // Initialize socket handlers
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { initializeTrackingSocket } = require('../sockets/tracking.socket');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { initializePickupSocket } = require('../sockets/pickup.socket');

        initializeTrackingSocket(socket);
        initializePickupSocket(socket);


        // Handle disconnection
        socket.on('disconnect', (reason) => {
            logger.info(`Client disconnected: ${socket.id} - Reason: ${reason}`);
        });

        // Handle errors
        socket.on('error', (error) => {
            logger.error(`Socket error for ${socket.id}:`, error);
        });
    });

    logger.info('Socket.IO server initialized');
    return io;
};

export const getIO = (): Server => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocket first.');
    }
    return io;
};

// Event emitters for different user types

/**
 * Emit event to specific user
 */
export const emitToUser = (userId: string, event: string, data: any): void => {
    io.to(`user:${userId}`).emit(event, data);
};

/**
 * Emit event to all students
 */
/**
 * Emit pickup reached notification to student
 */
export const emitPickupReached = (
    studentUserId: string,
    data: { pickupId: string; busNumber: string }
): void => {
    const io = getIO();
    io.to(`user:${studentUserId}`).emit('pickup:reached', data);
};

export const emitToStudents = (event: string, data: any): void => {
    io.to('STUDENT').emit(event, data);
};

/**
 * Emit event to all drivers
 */
export const emitToDrivers = (event: string, data: any): void => {
    io.to('DRIVER').emit(event, data);
};

/**
 * Emit event to all admins
 */
export const emitToAdmins = (event: string, data: any): void => {
    io.to('ADMIN').emit(event, data);
};

/**
 * Emit event to specific driver
 */
export const emitToDriver = (driverId: string, event: string, data: any): void => {
    io.to(`user:${driverId}`).emit(event, data);
};

/**
 * Emit bus location update to all students
 */
export const emitBusLocationUpdate = (busData: {
    busId: string;
    busNumber: string;
    routeName: string;
    lat: number;
    lng: number;
    timestamp: Date;
    isLive?: boolean;
}): void => {
    emitToStudents('bus:location-update', busData);
    emitToAdmins('bus:location-update', busData);
};

/**
 * Emit pickup request to driver
 */
export const emitPickupRequest = (
    driverId: string,
    pickupData: {
        pickupId: string;
        studentId: string;
        studentName: string;
        lat: number;
        lng: number;
        timestamp: Date;
    }
): void => {
    emitToDriver(driverId, 'pickup:new', pickupData);
};

/**
 * Emit pickup confirmation to student
 */
export const emitPickupConfirmation = (
    studentId: string,
    confirmationData: {
        pickupId: string;
        status: string;
        eta?: number;
    }
): void => {
    emitToUser(studentId, 'pickup:confirmed', confirmationData);
};

/**
 * Emit pickup completion to student
 */
export const emitPickupPicked = (
    studentId: string,
    data: { pickupId: string }
): void => {
    emitToUser(studentId, 'pickup:picked', data);
};

/**
 * Emit pickup cancellation to driver
 */
export const emitPickupCancellation = (
    driverId: string,
    cancellationData: {
        pickupId: string;
        studentId: string;
    }
): void => {
    emitToDriver(driverId, 'pickup:cancelled', cancellationData);
};

/**
 * Emit ETA update to student
 */
export const emitETAUpdate = (
    studentId: string,
    etaData: {
        busId: string;
        eta: number; // in minutes
        distance: number; // in meters
    }
): void => {
    emitToUser(studentId, 'bus:eta-update', etaData);
};

/**
 * Emit notification to user
 */
export const emitNotification = (
    userId: string,
    notification: {
        id: string;
        title: string;
        message: string;
        type: string;
    }
): void => {
    emitToUser(userId, 'notification:new', notification);
};

/**
 * Broadcast system message to all users
 */
export const broadcastSystemMessage = (message: {
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
}): void => {
    io.emit('system:message', message);
};
