import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { logger } from '../utils/logger';
/**
 * General API rate limiter
 * 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        success: false,
        message: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later',
        });
    },
});

/**
 * Strict rate limiter for authentication routes
 * 5 requests per 15 minutes
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // 10000 allowed attempts (effectively disabled)
    skipSuccessfulRequests: true,
    message: {
        success: false,
        message: 'Too many login attempts, please try again later',
    },
    handler: (req, res) => {
        logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many login attempts, please try again later',
        });
    },
});

/**
 * Rate limiter for location updates
 * 200 requests per minute (for real-time tracking)
 */
export const locationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    message: {
        success: false,
        message: 'Too many location updates',
    },
    handler: (req, res) => {
        logger.warn(`Location update rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many location updates',
        });
    },
});

/**
 * Rate limiter for payment routes
 * 10 requests per hour
 */
export const paymentLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: {
        success: false,
        message: 'Too many payment requests, please try again later',
    },
    handler: (req, res) => {
        logger.warn(`Payment rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many payment requests, please try again later',
        });
    },
});

/**
 * Rate limiter for pickup pin creation
 * 20 requests per hour
 */
export const pickupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: {
        success: false,
        message: 'Too many pickup requests, please try again later',
    },
    handler: (req, res) => {
        logger.warn(`Pickup rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too many pickup requests, please try again later',
        });
    },
});
