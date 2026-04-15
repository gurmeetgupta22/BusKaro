import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import * as adminService from './admin.service';
import { adminStudentManagementSchema } from './admin.validation';

/**
 * Get dashboard analytics
 * GET /api/admin/analytics
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await adminService.getAnalytics();
    res.status(200).json({ success: true, data: stats });
});

/**
 * List all students with optional filters
 * GET /api/admin/students
 */
export const listAllStudents = asyncHandler(async (req: Request, res: Response) => {
    const { department, semester, feeStatus } = req.query;

    const filters: any = {};
    if (department) filters.department = department as string;
    if (semester) filters.semester = parseInt(semester as string);
    if (feeStatus) filters.feeStatus = feeStatus as string;

    const students = await adminService.getAllStudents(filters);
    res.status(200).json({ success: true, data: students });
});

/**
 * Update student management status
 * PUT /api/admin/students/:id
 */
export const updateStudentManagement = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validatedData = adminStudentManagementSchema.parse(req.body);

    const updatedStudent = await adminService.updateStudentStatus(id, {
        ...validatedData,
        feeDueDate: validatedData.feeDueDate ? new Date(validatedData.feeDueDate) : undefined,
    });

    res.status(200).json({
        success: true,
        message: 'Student record updated successfully',
        data: updatedStudent,
    });
});

/**
 * List all drivers
 * GET /api/admin/drivers
 */
export const listAllDrivers = asyncHandler(async (req: Request, res: Response) => {
    const drivers = await adminService.getAllDrivers();
    res.status(200).json({ success: true, data: drivers });
});

/**
 * Get attendance report
 * GET /api/admin/reports/attendance
 */
export const getDetailedAttendanceReport = asyncHandler(async (req: Request, res: Response) => {
    const { start, end } = req.query;

    const startDate = start ? new Date(start as string) : new Date(new Date().setDate(new Date().getDate() - 7));
    const endDate = end ? new Date(end as string) : new Date();

    const report = await adminService.getAttendanceReport(startDate, endDate);
    res.status(200).json({ success: true, data: report });
});
