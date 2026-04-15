import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface EnvConfig {
    // Server
    nodeEnv: string;
    port: number;

    // Database
    databaseUrl: string;

    // Redis
    redis: {
        enabled: boolean;
        host: string;
        port: number;
        password: string;
    };

    // JWT
    jwt: {
        accessSecret: string;
        refreshSecret: string;
        accessExpiry: string;
        refreshExpiry: string;
    };

    // Google Maps
    googleMapsApiKey: string;

    // Razorpay
    razorpay: {
        keyId: string;
        keySecret: string;
    };

    // Firebase
    firebase: {
        projectId: string;
        privateKey: string;
        clientEmail: string;
    };

    // Rate Limiting
    rateLimit: {
        windowMs: number;
        maxRequests: number;
    };

    // CORS
    corsOrigin: string[];

    // Logging
    logLevel: string;

    // AI/ML
    aiModelPath: string;

    // Geo Settings
    geo: {
        maxPickupRadiusMeters: number;
        pickupClusterRadiusMeters: number;
        maxRealisticSpeedKmh: number;
        gpsUpdateIntervalSeconds: number;
        pickupPinExpiryMinutes: number;
    };
}

const getEnvVar = (key: string, defaultValue?: string): string => {
    const value = process.env[key] !== undefined ? process.env[key] : defaultValue;
    if (value === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value as string;
};

const getEnvNumber = (key: string, defaultValue?: number): number => {
    const value = process.env[key];
    if (!value && defaultValue === undefined) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value ? parseInt(value, 10) : defaultValue!;
};

export const config: EnvConfig = {
    nodeEnv: getEnvVar('NODE_ENV', 'development'),
    port: getEnvNumber('PORT', 5000),

    databaseUrl: getEnvVar('DATABASE_URL'),

    redis: {
        enabled: getEnvVar('REDIS_ENABLED', 'true') === 'true',
        host: getEnvVar('REDIS_HOST', 'localhost'),
        port: getEnvNumber('REDIS_PORT', 6379),
        password: getEnvVar('REDIS_PASSWORD', ''),
    },

    jwt: {
        accessSecret: getEnvVar('JWT_ACCESS_SECRET'),
        refreshSecret: getEnvVar('JWT_REFRESH_SECRET'),
        accessExpiry: getEnvVar('JWT_ACCESS_EXPIRY', '15m'),
        refreshExpiry: getEnvVar('JWT_REFRESH_EXPIRY', '7d'),
    },

    googleMapsApiKey: getEnvVar('GOOGLE_MAPS_API_KEY'),

    razorpay: {
        keyId: getEnvVar('RAZORPAY_KEY_ID'),
        keySecret: getEnvVar('RAZORPAY_KEY_SECRET'),
    },

    firebase: {
        projectId: getEnvVar('FIREBASE_PROJECT_ID'),
        privateKey: getEnvVar('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
        clientEmail: getEnvVar('FIREBASE_CLIENT_EMAIL'),
    },

    rateLimit: {
        windowMs: getEnvNumber('RATE_LIMIT_WINDOW_MS', 900000), // 15 minutes
        maxRequests: getEnvNumber('RATE_LIMIT_MAX_REQUESTS', 100),
    },

    corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:3000').split(','),

    logLevel: getEnvVar('LOG_LEVEL', 'info'),

    aiModelPath: getEnvVar('AI_MODEL_PATH', './models'),

    geo: {
        maxPickupRadiusMeters: getEnvNumber('MAX_PICKUP_RADIUS_METERS', 5000),
        pickupClusterRadiusMeters: getEnvNumber('PICKUP_CLUSTER_RADIUS_METERS', 100),
        maxRealisticSpeedKmh: getEnvNumber('MAX_REALISTIC_SPEED_KMH', 120),
        gpsUpdateIntervalSeconds: getEnvNumber('GPS_UPDATE_INTERVAL_SECONDS', 5),
        pickupPinExpiryMinutes: getEnvNumber('PICKUP_PIN_EXPIRY_MINUTES', 30),
    },
};

export default config;
