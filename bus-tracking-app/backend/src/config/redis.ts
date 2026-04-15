import Redis from 'ioredis';
import { config } from './env';
import { logger } from '../utils/logger';

// Redis Client singleton
class RedisClient {
    private static instance: Redis;

    private constructor() { }

    public static getInstance(): Redis | null {
        if (!config.redis.enabled) {
            return null;
        }

        if (!RedisClient.instance) {
            RedisClient.instance = new Redis({
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password || undefined,
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
            });

            RedisClient.instance.on('connect', () => {
                logger.info('Redis connection established');
            });

            RedisClient.instance.on('error', (error) => {
                logger.error('Redis connection error:', error);
            });

            RedisClient.instance.on('ready', () => {
                logger.info('Redis client ready');
            });

            RedisClient.instance.on('reconnecting', () => {
                logger.warn('Redis client reconnecting...');
            });
        }

        return RedisClient.instance;
    }

    public static async disconnect(): Promise<void> {
        if (RedisClient.instance) {
            await RedisClient.instance.quit();
            logger.info('Redis connection closed');
        }
    }

    public static async healthCheck(): Promise<boolean> {
        if (!config.redis.enabled || !RedisClient.instance) {
            return false;
        }
        try {
            const result = await RedisClient.instance.ping();
            return result === 'PONG';
        } catch (error) {
            logger.error('Redis health check failed:', error);
            return false;
        }
    }
}

export const redis = RedisClient.getInstance();
export const disconnectRedis = RedisClient.disconnect;
export const checkRedisHealth = RedisClient.healthCheck;

const ensureRedis = (fnName: string) => {
    if (!config.redis.enabled || !redis) {
        // logger.debug(`Redis disabled: Skipping ${fnName}`);
        return false;
    }
    return true;
};

// Helper functions for common Redis operations

/**
 * Cache data with TTL
 */
export const cacheSet = async (
    key: string,
    value: any,
    ttlSeconds: number = 300
): Promise<void> => {
    if (!ensureRedis('cacheSet')) return;
    try {
        await redis!.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (error) {
        logger.error(`Error setting cache for key ${key}:`, error);
        throw error;
    }
};

/**
 * Get cached data
 */
export const cacheGet = async <T>(key: string): Promise<T | null> => {
    if (!ensureRedis('cacheGet')) return null;
    try {
        const data = await redis!.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        logger.error(`Error getting cache for key ${key}:`, error);
        return null;
    }
};

/**
 * Delete cached data
 */
export const cacheDel = async (key: string): Promise<void> => {
    if (!ensureRedis('cacheDel')) return;
    try {
        await redis!.del(key);
    } catch (error) {
        logger.error(`Error deleting cache for key ${key}:`, error);
    }
};

/**
 * Cache bus location
 */
export const cacheBusLocation = async (
    busId: string,
    location: { lat: number; lng: number; timestamp: Date }
): Promise<void> => {
    const key = `bus:location:${busId}`;
    await cacheSet(key, location, 10); // 10 seconds TTL
};

/**
 * Get cached bus location
 */
export const getCachedBusLocation = async (
    busId: string
): Promise<{ lat: number; lng: number; timestamp: Date } | null> => {
    const key = `bus:location:${busId}`;
    return await cacheGet(key);
};

/**
 * Cache all active buses
 */
export const cacheActiveBuses = async (buses: any[]): Promise<void> => {
    const key = 'buses:active';
    await cacheSet(key, buses, 5); // 5 seconds TTL
};

/**
 * Get all cached active buses
 */
export const getCachedActiveBuses = async (): Promise<any[] | null> => {
    const key = 'buses:active';
    return await cacheGet(key);
};

/**
 * Cache pickup pins for a driver
 */
export const cacheDriverPickups = async (
    driverId: string,
    pickups: any[]
): Promise<void> => {
    const key = `driver:pickups:${driverId}`;
    await cacheSet(key, pickups, 10); // 10 seconds TTL
};

/**
 * Get cached pickup pins for a driver
 */
export const getCachedDriverPickups = async (
    driverId: string
): Promise<any[] | null> => {
    const key = `driver:pickups:${driverId}`;
    return await cacheGet(key);
};

/**
 * Invalidate all cache with pattern
 */
export const invalidateCachePattern = async (pattern: string): Promise<void> => {
    if (!ensureRedis('invalidateCachePattern')) return;
    try {
        const keys = await redis!.keys(pattern);
        if (keys.length > 0) {
            await redis!.del(...keys);
        }
    } catch (error) {
        logger.error(`Error invalidating cache pattern ${pattern}:`, error);
    }
};
