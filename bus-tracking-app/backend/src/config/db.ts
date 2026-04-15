import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Prisma Client singleton
class DatabaseClient {
    private static instance: PrismaClient;

    private constructor() { }

    public static getInstance(): PrismaClient {
        if (!DatabaseClient.instance) {
            DatabaseClient.instance = new PrismaClient({
                log: [
                    { level: 'query', emit: 'event' },
                    { level: 'error', emit: 'event' },
                    { level: 'warn', emit: 'event' },
                ],
            });

            // Log queries in development
            if (process.env.NODE_ENV === 'development') {
                DatabaseClient.instance.$on('query' as never, (e: any) => {
                    logger.debug('Query: ' + e.query);
                    logger.debug('Duration: ' + e.duration + 'ms');
                });
            }

            // Log errors
            DatabaseClient.instance.$on('error' as never, (e: any) => {
                logger.error('Prisma Error:', e);
            });

            // Log warnings
            DatabaseClient.instance.$on('warn' as never, (e: any) => {
                logger.warn('Prisma Warning:', e);
            });

            logger.info('Database connection established');
        }

        return DatabaseClient.instance;
    }

    public static async disconnect(): Promise<void> {
        if (DatabaseClient.instance) {
            await DatabaseClient.instance.$disconnect();
            logger.info('Database connection closed');
        }
    }

    public static async healthCheck(): Promise<boolean> {
        try {
            await DatabaseClient.instance.$queryRaw`SELECT 1`;
            return true;
        } catch (error) {
            logger.error('Database health check failed:', error);
            return false;
        }
    }
}

export const prisma = DatabaseClient.getInstance();
export const disconnectDatabase = DatabaseClient.disconnect;
export const checkDatabaseHealth = DatabaseClient.healthCheck;
