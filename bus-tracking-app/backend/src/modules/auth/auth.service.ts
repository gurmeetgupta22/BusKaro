import bcrypt from 'bcrypt';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { generateTokenPair, verifyRefreshToken } from '../../utils/tokenUtils';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import {
    LoginInput,
    StudentRegisterInput,
    DriverRegisterInput,
    AdminRegisterInput,
} from './auth.validation';
import { updatePasswordInExcel } from '../../utils/excelSync';

const SALT_ROUNDS = 12;

/**
 * Hash password
 */
const hashPassword = async (password: string): Promise<string> => {
    return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare password
 */
const comparePassword = async (
    password: string,
    hash: string
): Promise<boolean> => {
    return await bcrypt.compare(password, hash);
};

/**
 * Login service
 */
export const login = async (data: LoginInput) => {
    const { email, password } = data;

    // Find user
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            student: true,
            driver: {
                include: { assignedBus: true }
            },
        },
    });

    if (!user) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
        throw new ApiError(403, 'Account is deactivated');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);

    if (!isValidPassword) {
        throw new ApiError(401, 'Invalid email or password');
    }

    // Generate tokens
    const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
    });

    // Store refresh token in database
    await prisma.refreshToken.create({
        data: {
            token: tokens.refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
    });

    // Update last login
    await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
    });

    logger.info(`User logged in: ${user.email} (${user.role})`);

    // Return user data based on role
    let userData: any = {
        id: user.id,
        email: user.email,
        role: user.role,
    };

    if (user.role === 'STUDENT' && user.student) {
        userData = {
            ...userData,
            student: {
                id: user.student.id,
                fullName: user.student.fullName,
                rollNumber: user.student.rollNumber,
                department: user.student.department,
                semester: user.student.semester,
                feeStatus: user.student.feeStatus,
                feeDueDate: user.student.feeDueDate,
            },
        };
    } else if (user.role === 'DRIVER' && user.driver) {
        userData = {
            ...userData,
            driver: {
                id: user.driver.id,
                fullName: user.driver.fullName,
                licenseNumber: user.driver.licenseNumber,
                assignedBusId: user.driver.assignedBusId,
                assignedBus: user.driver.assignedBus ? {
                    id: user.driver.assignedBus.id,
                    busNumber: user.driver.assignedBus.busNumber,
                    routeName: user.driver.assignedBus.routeName,
                } : null,
            },
        };
    }

    return {
        user: userData,
        tokens,
    };
};

/**
 * Register student
 */
export const registerStudent = async (data: StudentRegisterInput) => {
    const { email, password, fullName, rollNumber, department, semester, phoneNumber } =
        data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new ApiError(400, 'Email already registered');
    }

    // Check if roll number already exists
    const existingStudent = await prisma.student.findUnique({
        where: { rollNumber },
    });

    if (existingStudent) {
        throw new ApiError(400, 'Roll number already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user and student in transaction
    const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                email,
                passwordHash,
                role: 'STUDENT',
            },
        });

        const student = await tx.student.create({
            data: {
                userId: user.id,
                fullName,
                rollNumber,
                department,
                semester,
                phoneNumber,
                feeStatus: 'DUE',
                feeDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            },
        });

        return { user, student };
    });

    logger.info(`Student registered: ${email} - ${rollNumber}`);

    // Generate tokens
    const tokens = generateTokenPair({
        userId: result.user.id,
        email: result.user.email,
        role: result.user.role,
    });

    // Store refresh token
    await prisma.refreshToken.create({
        data: {
            token: tokens.refreshToken,
            userId: result.user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });

    return {
        user: {
            id: result.user.id,
            email: result.user.email,
            role: result.user.role,
            student: {
                id: result.student.id,
                fullName: result.student.fullName,
                rollNumber: result.student.rollNumber,
                department: result.student.department,
                semester: result.student.semester,
                feeStatus: result.student.feeStatus,
                feeDueDate: result.student.feeDueDate,
            },
        },
        tokens,
    };
};

/**
 * Register driver (admin only)
 */
export const registerDriver = async (data: DriverRegisterInput) => {
    const { email, password, fullName, licenseNumber, phoneNumber } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new ApiError(400, 'Email already registered');
    }

    // Check if license number already exists
    const existingDriver = await prisma.driver.findUnique({
        where: { licenseNumber },
    });

    if (existingDriver) {
        throw new ApiError(400, 'License number already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user and driver in transaction
    const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: {
                email,
                passwordHash,
                role: 'DRIVER',
            },
        });

        const driver = await tx.driver.create({
            data: {
                userId: user.id,
                fullName,
                licenseNumber,
                phoneNumber,
            },
        });

        return { user, driver };
    });

    logger.info(`Driver registered: ${email} - ${licenseNumber}`);

    return {
        id: result.user.id,
        email: result.user.email,
        role: result.user.role,
        driver: {
            id: result.driver.id,
            fullName: result.driver.fullName,
            licenseNumber: result.driver.licenseNumber,
        },
    };
};

/**
 * Register admin (super admin only)
 */
export const registerAdmin = async (data: AdminRegisterInput) => {
    const { email, password } = data;

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });

    if (existingUser) {
        throw new ApiError(400, 'Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create admin user
    const user = await prisma.user.create({
        data: {
            email,
            passwordHash,
            role: 'ADMIN',
        },
    });

    logger.info(`Admin registered: ${email}`);

    return {
        id: user.id,
        email: user.email,
        role: user.role,
    };
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken: string) => {
    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if refresh token exists in database
    const storedToken = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
    });

    if (!storedToken) {
        throw new ApiError(401, 'Invalid refresh token');
    }

    // Check if token is expired
    if (storedToken.expiresAt < new Date()) {
        await prisma.refreshToken.delete({
            where: { token: refreshToken },
        });
        throw new ApiError(401, 'Refresh token expired');
    }

    // Get user
    const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
    });

    if (!user || !user.isActive) {
        throw new ApiError(401, 'User not found or inactive');
    }

    // Generate new token pair
    const tokens = generateTokenPair({
        userId: user.id,
        email: user.email,
        role: user.role,
    });

    // Delete old refresh token and create new one
    await prisma.$transaction([
        prisma.refreshToken.delete({
            where: { token: refreshToken },
        }),
        prisma.refreshToken.create({
            data: {
                token: tokens.refreshToken,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        }),
    ]);

    logger.info(`Token refreshed for user: ${user.email}`);

    return tokens;
};

/**
 * Logout
 */
export const logout = async (refreshToken: string) => {
    // Delete refresh token from database
    await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
    });

    logger.info('User logged out');
};

/**
 * Change password
 */
export const changePassword = async (
    userId: string,
    currentPassword: string,
    newPassword: string
) => {
    // Get user
    const user = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!user) {
        throw new ApiError(404, 'User not found');
    }

    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.passwordHash);

    if (!isValidPassword) {
        throw new ApiError(401, 'Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
    });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({
        where: { userId },
    });

    // Sync with Excel
    if (user.role === 'STUDENT' || user.role === 'DRIVER') {
        // We do this asynchronously to not block the response, but it's important
        updatePasswordInExcel(user.email, newPassword, user.role).catch(err => {
            logger.error(`Excel sync failed for ${user.email} password change`, err);
        });
    }

    logger.info(`Password changed for user: ${user.email}`);
};
