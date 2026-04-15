import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import * as authService from './auth.service';
import {
    loginSchema,
    studentRegisterSchema,
    driverRegisterSchema,
    adminRegisterSchema,
    refreshTokenSchema,
    changePasswordSchema,
} from './auth.validation';
import { logger } from '../../utils/logger';

/**
 * Login controller
 * POST /api/auth/login
 */
export const loginController = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = loginSchema.parse(req.body);
    const result = await authService.login(validatedData);

    res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
    });
});

/**
 * Student registration controller
 * POST /api/auth/register/student
 */
export const registerStudentController = asyncHandler(
    async (req: Request, res: Response) => {
        const validatedData = studentRegisterSchema.parse(req.body);
        const result = await authService.registerStudent(validatedData);

        res.status(201).json({
            success: true,
            message: 'Student registered successfully',
            data: result,
        });
    }
);

/**
 * Driver registration controller (admin only)
 * POST /api/auth/register/driver
 */
export const registerDriverController = asyncHandler(
    async (req: Request, res: Response) => {
        const validatedData = driverRegisterSchema.parse(req.body);
        const result = await authService.registerDriver(validatedData);

        res.status(201).json({
            success: true,
            message: 'Driver registered successfully',
            data: result,
        });
    }
);

/**
 * Admin registration controller (super admin only)
 * POST /api/auth/register/admin
 */
export const registerAdminController = asyncHandler(
    async (req: Request, res: Response) => {
        const validatedData = adminRegisterSchema.parse(req.body);
        const result = await authService.registerAdmin(validatedData);

        res.status(201).json({
            success: true,
            message: 'Admin registered successfully',
            data: result,
        });
    }
);

/**
 * Refresh token controller
 * POST /api/auth/refresh
 */
export const refreshTokenController = asyncHandler(
    async (req: Request, res: Response) => {
        const { refreshToken } = refreshTokenSchema.parse(req.body);
        const tokens = await authService.refreshAccessToken(refreshToken);

        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: tokens,
        });
    }
);

/**
 * Logout controller
 * POST /api/auth/logout
 */
export const logoutController = asyncHandler(
    async (req: Request, res: Response) => {
        const { refreshToken } = req.body;

        if (refreshToken) {
            await authService.logout(refreshToken);
        }

        res.status(200).json({
            success: true,
            message: 'Logout successful',
        });
    }
);

/**
 * Change password controller
 * POST /api/auth/change-password
 */
export const changePasswordController = asyncHandler(
    async (req: Request, res: Response) => {
        const validatedData = changePasswordSchema.parse(req.body);
        const userId = req.user!.userId;

        await authService.changePassword(
            userId,
            validatedData.currentPassword,
            validatedData.newPassword
        );

        res.status(200).json({
            success: true,
            message: 'Password changed successfully',
        });
    }
);

/**
 * Get current user controller
 * GET /api/auth/me
 */
export const getCurrentUserController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user!.userId;

        // This would typically fetch fresh user data from database
        // For now, return the user from token
        res.status(200).json({
            success: true,
            data: req.user,
        });
    }
);
