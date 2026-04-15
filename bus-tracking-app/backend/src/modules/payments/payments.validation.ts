import { z } from 'zod';

/**
 * Initiate payment validation schema
 */
export const initiatePaymentSchema = z.object({
    amount: z.number().positive('Amount must be positive'),
});

/**
 * Verify payment validation schema
 */
export const verifyPaymentSchema = z.object({
    razorpayOrderId: z.string().min(1, 'Order ID is required'),
    razorpayPaymentId: z.string().min(1, 'Payment ID is required'),
    razorpaySignature: z.string().min(1, 'Signature is required'),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
