import { z } from 'zod';

/**
 * Admin student record management schema
 */
export const adminStudentManagementSchema = z.object({
    feeStatus: z.enum(['PAID', 'DUE', 'OVERDUE']).optional(),
    feeDueDate: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
    department: z.string().optional(),
    semester: z.number().int().min(1).max(8).optional(),
});

/**
 * Admin bus assignment management
 */
export const adminBusAssignmentSchema = z.object({
    busId: z.string().uuid(),
    driverId: z.string().uuid(),
});

export type AdminStudentManagementInput = z.infer<typeof adminStudentManagementSchema>;
export type AdminBusAssignmentInput = z.infer<typeof adminBusAssignmentSchema>;
