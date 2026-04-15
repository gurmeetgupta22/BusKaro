import { z } from 'zod';

/**
 * Update driver profile validation schema
 */
export const updateDriverSchema = z.object({
    fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
    phoneNumber: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number').optional(),
    profilePhoto: z.string().url('Invalid photo URL').optional(),
});

export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;
