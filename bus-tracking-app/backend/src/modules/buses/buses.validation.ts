import { z } from 'zod';

/**
 * Create bus validation schema
 */
export const createBusSchema = z.object({
    busNumber: z.string().min(1, 'Bus number is required'),
    routeName: z.string().min(1, 'Route name is required'),
    capacity: z.number().int().min(1, 'Capacity must be at least 1').optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
});

/**
 * Update bus validation schema
 */
export const updateBusSchema = createBusSchema.partial();

/**
 * Assign driver validation schema
 */
export const assignDriverSchema = z.object({
    driverId: z.string().uuid('Invalid driver ID'),
});

export type CreateBusInput = z.infer<typeof createBusSchema>;
export type UpdateBusInput = z.infer<typeof updateBusSchema>;
export type AssignDriverInput = z.infer<typeof assignDriverSchema>;
