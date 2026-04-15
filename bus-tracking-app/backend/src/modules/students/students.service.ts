import { prisma } from '../../config/db';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { UpdateStudentInput } from './students.validation';

/**
 * Get student profile by user ID
 */
export const getStudentProfile = async (userId: string) => {
    const student = await prisma.student.findUnique({
        where: { userId },
        include: {
            user: {
                select: {
                    email: true,
                    role: true,
                    isActive: true,
                    lastLogin: true,
                },
            },
        },
    });

    if (!student) {
        throw new ApiError(404, 'Student profile not found');
    }

    return student;
};

/**
 * Update student profile
 */
export const updateStudentProfile = async (userId: string, data: UpdateStudentInput) => {
    const student = await prisma.student.findUnique({
        where: { userId },
    });

    if (!student) {
        throw new ApiError(404, 'Student profile not found');
    }

    const updatedStudent = await prisma.student.update({
        where: { userId },
        data,
    });

    logger.info(`Student profile updated for userId: ${userId}`);
    return updatedStudent;
};

/**
 * Get student fee status
 */
export const getFeeStatus = async (userId: string) => {
    const student = await prisma.student.findUnique({
        where: { userId },
        select: {
            feeStatus: true,
            feeDueDate: true,
            fullName: true,
            rollNumber: true,
        },
    });

    if (!student) {
        throw new ApiError(404, 'Student not found');
    }

    return student;
};

/**
 * Get student pickup history
 */
export const getPickupHistory = async (studentId: string) => {
    const history = await prisma.pickupPin.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        take: 20,
    });

    return history;
};

/**
 * Get student attendance record
 */
export const getAttendanceRecords = async (studentId: string) => {
    const attendance = await prisma.attendance.findMany({
        where: { studentId },
        include: {
            bus: {
                select: {
                    busNumber: true,
                    routeName: true,
                },
            },
        },
        orderBy: { boardedAt: 'desc' },
    });

    return attendance;
};
