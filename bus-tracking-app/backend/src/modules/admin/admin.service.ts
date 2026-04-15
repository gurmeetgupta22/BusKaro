import { prisma } from '../../config/db';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

/**
 * Get all students for admin dashboard
 */
export const getAllStudents = async (filters?: {
    department?: string;
    semester?: number;
    feeStatus?: any;
}) => {
    return await prisma.student.findMany({
        where: filters,
        include: {
            user: {
                select: {
                    email: true,
                    isActive: true,
                    lastLogin: true,
                },
            },
        },
        orderBy: { rollNumber: 'asc' },
    });
};

/**
 * Get all drivers for admin dashboard
 */
export const getAllDrivers = async () => {
    return await prisma.driver.findMany({
        include: {
            user: {
                select: {
                    email: true,
                    isActive: true,
                },
            },
            assignedBus: {
                select: {
                    busNumber: true,
                    routeName: true,
                },
            },
        },
    });
};

/**
 * Get system-wide analytics
 */
export const getAnalytics = async () => {
    const [
        studentCount,
        driverCount,
        busCount,
        activePickups,
        totalAttendanceToday,
        pendingFeesCount,
    ] = await Promise.all([
        prisma.student.count(),
        prisma.driver.count(),
        prisma.bus.count(),
        prisma.pickupPin.count({ where: { status: 'ACTIVE' } }),
        prisma.attendance.count({
            where: {
                date: {
                    gte: new Date(new Date().setHours(0, 0, 0, 0)),
                },
            },
        }),
        prisma.student.count({ where: { feeStatus: 'DUE' } }),
    ]);

    return {
        overview: {
            students: studentCount,
            drivers: driverCount,
            buses: busCount,
        },
        realtime: {
            activePickups,
            attendanceToday: totalAttendanceToday,
        },
        finance: {
            pendingFees: pendingFeesCount,
        },
    };
};

/**
 * Verify student record (bulk or single)
 */
export const updateStudentStatus = async (
    studentId: string,
    data: {
        feeStatus?: any;
        isActive?: boolean;
        feeDueDate?: Date;
    }
) => {
    const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: { user: true },
    });

    if (!student) {
        throw new ApiError(404, 'Student not found');
    }

    return await prisma.$transaction(async (tx) => {
        // Update student fields
        const updatedStudent = await tx.student.update({
            where: { id: studentId },
            data: {
                ...(data.feeStatus && { feeStatus: data.feeStatus }),
                ...(data.feeDueDate && { feeDueDate: data.feeDueDate }),
            },
        });

        // Update user active status if provided
        if (data.isActive !== undefined) {
            await tx.user.update({
                where: { id: student.userId },
                data: { isActive: data.isActive },
            });
        }

        return updatedStudent;
    });
};

/**
 * Get detailed attendance report
 */
export const getAttendanceReport = async (startDate: Date, endDate: Date) => {
    return await prisma.attendance.findMany({
        where: {
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
        include: {
            student: {
                select: {
                    fullName: true,
                    rollNumber: true,
                    department: true,
                },
            },
            bus: {
                select: {
                    busNumber: true,
                    routeName: true,
                },
            },
        },
        orderBy: { date: 'desc' },
    });
};
