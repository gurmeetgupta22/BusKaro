import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import * as paymentsService from './payments.service';
import { initiatePaymentSchema, verifyPaymentSchema } from './payments.validation';

/**
 * Initiate a payment
 * POST /api/payments/initiate
 */
export const initiatePayment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const { amount } = initiatePaymentSchema.parse(req.body);

    const order = await paymentsService.createOrder(userId, amount);

    res.status(200).json({
        success: true,
        data: order,
    });
});

/**
 * Verify a payment
 * POST /api/payments/verify
 */
export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const validatedData = verifyPaymentSchema.parse(req.body);

    const payment = await paymentsService.verifyPayment(
        userId,
        validatedData.razorpayOrderId,
        validatedData.razorpayPaymentId,
        validatedData.razorpaySignature
    );

    res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: payment,
    });
});

/**
 * Get payment history
 * GET /api/payments/history
 */
export const getHistory = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const history = await paymentsService.getStudentPayments(userId);

    res.status(200).json({
        success: true,
        data: history,
    });
});
