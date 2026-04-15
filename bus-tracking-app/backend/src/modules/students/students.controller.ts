import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import * as studentsService from './students.service';
import { updateStudentSchema } from './students.validation';
import fs from 'fs';
import path from 'path';

/**
 * Get current student profile
 * GET /api/students/profile
 */
export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const profile = await studentsService.getStudentProfile(userId);

    res.status(200).json({
        success: true,
        data: profile,
    });
});

/**
 * Update current student profile
 * PUT /api/students/profile
 */
export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const validatedData = updateStudentSchema.parse(req.body);

    const updatedProfile = await studentsService.updateStudentProfile(userId, validatedData);

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedProfile,
    });
});

/**
 * Get student fee status
 * GET /api/students/fee-status
 */
export const getMyFeeStatus = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const feeStatus = await studentsService.getFeeStatus(userId);

    res.status(200).json({
        success: true,
        data: feeStatus,
    });
});

/**
 * Get student activity history (pickups + attendance)
 * GET /api/students/history
 */
export const getMyHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const student = await studentsService.getStudentProfile(userId);

    const [pickups, attendance] = await Promise.all([
        studentsService.getPickupHistory(student.id),
        studentsService.getAttendanceRecords(student.id),
    ]);

    res.status(200).json({
        success: true,
        data: {
            pickups,
            attendance,
        },
    });
});

/**
 * Report an issue (writes to txt file)
 * POST /api/students/report-issue
 */
export const reportIssue = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { issue } = req.body;

    if (!issue || issue.trim() === '') {
        res.status(400).json({ success: false, message: 'Issue cannot be empty' });
        return;
    }

    const profile = await studentsService.getStudentProfile(userId);

    const dataDir = path.join(__dirname, '../../../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const issuesFilePath = path.join(dataDir, 'reported_issues.txt');
    const logEntry = `[${new Date().toLocaleString()}]\nStudent: ${profile.fullName} (${profile.rollNumber}) - Email: ${profile.user.email}\nIssue: ${issue}\n----------------------------------------------------\n`;

    fs.appendFileSync(issuesFilePath, logEntry);

    res.status(200).json({
        success: true,
        message: 'Issue reported successfully. Admin will review it shortly.',
    });
    return;
});
