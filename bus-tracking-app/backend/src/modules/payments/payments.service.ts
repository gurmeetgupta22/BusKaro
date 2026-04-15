import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../../config/db';
import { config } from '../../config/env';
import { ApiError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const razorpay = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
});

/**
 * Initiate a payment order
 */
export const createOrder = async (userId: string, amount: number) => {
    const student = await prisma.student.findUnique({
        where: { userId },
    });

    if (!student) {
        throw new ApiError(404, 'Student not found');
    }

    // Create Razorpay order
    const options = {
        amount: Math.round(amount * 100), // convert to paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
    };

    try {
        const order = await razorpay.orders.create(options);

        // Record pending payment in database
        await prisma.payment.create({
            data: {
                studentId: student.id,
                amount,
                razorpayOrderId: order.id,
                status: 'PENDING',
            },
        });

        return order;
    } catch (error) {
        logger.error('Razorpay order creation failed:', error);
        throw new ApiError(500, 'Failed to initiate payment');
    }
};

/**
 * Verify payment signature and update status
 */
export const verifyPayment = async (
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
) => {
    // 1. Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
        .createHmac('sha256', config.razorpay.keySecret)
        .update(body.toString())
        .digest('hex');

    const isValid = expectedSignature === razorpaySignature;

    if (!isValid) {
        throw new ApiError(400, 'Invalid payment signature');
    }

    // 2. Update payment status in database
    return await prisma.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
            where: { razorpayOrderId },
        });

        if (!payment) {
            throw new ApiError(404, 'Payment record not found');
        }

        const updatedPayment = await tx.payment.update({
            where: { razorpayOrderId },
            data: {
                status: 'SUCCESS',
                razorpayPaymentId,
                razorpaySignature,
                paidAt: new Date(),
            },
        });

        // 3. Update student fee status
        await tx.student.update({
            where: { id: payment.studentId },
            data: {
                feeStatus: 'PAID',
                // Extend fee due date by 30 days
                feeDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
        });

        logger.info(`Payment successful for order: ${razorpayOrderId}`);
        return updatedPayment;
    });
};

/**
 * Get student payment history
 */
export const getStudentPayments = async (userId: string) => {
    const student = await prisma.student.findUnique({
        where: { userId },
    });

    if (!student) {
        throw new ApiError(404, 'Student not found');
    }

    return await prisma.payment.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
    });
};
