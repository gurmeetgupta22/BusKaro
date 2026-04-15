import { z } from 'zod';

/**
 * Login validation schema
 */
export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Student registration validation schema
 */
export const studentRegisterSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    rollNumber: z.string().min(1, 'Roll number is required'),
    department: z.string().min(1, 'Department is required'),
    semester: z.number().int().min(1).max(8, 'Semester must be between 1 and 8'),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number').optional(),
});

/**
 * Driver registration validation schema (admin only)
 */
export const driverRegisterSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    fullName: z.string().min(2, 'Full name must be at least 2 characters'),
    licenseNumber: z.string().min(1, 'License number is required'),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number'),
});

/**
 * Admin registration validation schema (super admin only)
 */
export const adminRegisterSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Change password validation schema
 */
export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>;
export type DriverRegisterInput = z.infer<typeof driverRegisterSchema>;
export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
