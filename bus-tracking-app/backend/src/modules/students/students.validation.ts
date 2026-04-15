import { z } from 'zod';

/**
 * Update student profile validation schema
 */
export const updateStudentSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
    department: z.string().min(1, 'Department is required').optional(),
    semester: z.number().int().min(1).max(8, 'Semester must be between 1 and 8').optional(),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number').optional(),
    profilePhoto: z.string().url('Invalid photo URL').optional(),
});

/**
 * Admin student update schema
 */
export const adminUpdateStudentSchema = updateStudentSchema.extend({
    feeStatus: z.enum(['PAID', 'DUE', 'OVERDUE']).optional(),
    feeDueDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
});

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type AdminUpdateStudentInput = z.infer<typeof adminUpdateStudentSchema>;
