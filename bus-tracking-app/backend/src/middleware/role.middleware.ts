import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Role-based authorization middleware factory
 * @param allowedRoles Array of roles that can access the route
 */
export const authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            // Check if user is authenticated
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            // Check if user has required role
            if (!allowedRoles.includes(req.user.role)) {
                logger.warn(
                    `Unauthorized access attempt by user ${req.user.userId} (${req.user.role}) to route requiring ${allowedRoles.join(', ')}`
                );

                res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions',
                });
                return;
            }

            next();
        } catch (error) {
            logger.error('Authorization error:', error);
            res.status(500).json({
                success: false,
                message: 'Authorization failed',
            });
        }
    };
};

/**
 * Check if user is a student
 */
export const isStudent = authorize('STUDENT');

/**
 * Check if user is a driver
 */
export const isDriver = authorize('DRIVER');

/**
 * Check if user is an admin
 */
export const isAdmin = authorize('ADMIN');

/**
 * Check if user is student or admin
 */
export const isStudentOrAdmin = authorize('STUDENT', 'ADMIN');

/**
 * Check if user is driver or admin
 */
export const isDriverOrAdmin = authorize('DRIVER', 'ADMIN');

/**
 * Resource ownership check
 * Ensures user can only access their own resources (unless admin)
 */
export const checkOwnership = (resourceUserIdField: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            if (!req.user) {
                res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
                return;
            }

            // Admins can access any resource
            if (req.user.role === 'ADMIN') {
                next();
                return;
            }

            // Get resource user ID from params, query, or body
            const resourceUserId =
                req.params[resourceUserIdField] ||
                req.query[resourceUserIdField] ||
                req.body[resourceUserIdField];

            // Check if user owns the resource
            if (resourceUserId && resourceUserId !== req.user.userId) {
                logger.warn(
                    `User ${req.user.userId} attempted to access resource owned by ${resourceUserId}`
                );

                res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
                return;
            }

            next();
        } catch (error) {
            logger.error('Ownership check error:', error);
            res.status(500).json({
                success: false,
                message: 'Authorization failed',
            });
        }
    };
};
