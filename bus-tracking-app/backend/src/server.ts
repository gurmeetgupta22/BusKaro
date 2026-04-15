import http from 'http';
import app from './app';
import { config } from './config/env';
import { logger } from './utils/logger';
import { disconnectDatabase, checkDatabaseHealth } from './config/db';
import { disconnectRedis, checkRedisHealth } from './config/redis';
import { initializeSocket } from './config/socket';
import { startExcelWatcher } from './utils/excelWatcher';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = initializeSocket(server);

/**
 * Start server
 */
const startServer = async () => {
    try {
        console.log('Starting server...');
        // Check database connection
        console.log('Checking DB...');
        const dbHealthy = await checkDatabaseHealth();
        if (!dbHealthy) {
            throw new Error('Database connection failed');
        }
        console.log('DB OK');
        logger.info('✓ Database connection verified');

        // Check Redis connection
        if (!config.redis.enabled) {
            logger.info('Redis is disabled in configuration - Skipping Redis health check');
        } else {
            const redisHealthy = await checkRedisHealth();
            if (!redisHealthy) {
                logger.warn('Redis connection failed - Continuing without Redis caching');
            } else {
                logger.info('✓ Redis connection verified');
            }
        }

        // Create server error handler
        server.on('error', (error: any) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`Port ${config.port} is already in use`);
            } else {
                logger.error('Server error:', error);
            }
            process.exit(1);
        });

        // Start listening
        server.listen(config.port, () => {
            logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚌 Bus Tracking API Server                              ║
║                                                            ║
║   Environment: ${config.nodeEnv.padEnd(43)}║
║   Port: ${config.port.toString().padEnd(50)}║
║   URL: http://localhost:${config.port.toString().padEnd(37)}║
║                                                            ║
║   Status: ✓ Running                                       ║
      `);

            // Start the file watcher to auto-seed when excel files change
            startExcelWatcher();
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

/**
 * Graceful shutdown
 */
const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    // Stop accepting new connections
    server.close(async () => {
        logger.info('HTTP server closed');

        try {
            // Close Socket.IO connections
            io.close(() => {
                logger.info('Socket.IO server closed');
            });

            // Disconnect from database
            await disconnectDatabase();

            // Disconnect from Redis
            await disconnectRedis();

            logger.info('Graceful shutdown completed');
            process.exit(0);
        } catch (error) {
            logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
};

/**
 * Handle uncaught exceptions
 */
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

/**
 * Handle unhandled promise rejections
 */
process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Rejection:', reason);
    process.exit(1);
});

/**
 * Handle shutdown signals
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();
