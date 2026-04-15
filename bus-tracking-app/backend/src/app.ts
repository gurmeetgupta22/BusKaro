import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

// Import routes
import authRoutes from './modules/auth/auth.routes';
import studentRoutes from './modules/students/students.routes';
import driverRoutes from './modules/drivers/drivers.routes';
import busRoutes from './modules/buses/buses.routes';
import adminRoutes from './modules/admin/admin.routes';
import paymentRoutes from './modules/payments/payments.routes';

const app: Application = express();

/**
 * Security middleware
 */
app.use(helmet());
app.use(
    cors({
        origin: config.corsOrigin,
        credentials: true,
    })
);

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Rate limiting
 */
app.use('/api', apiLimiter);

/**
 * Root route
 */
app.get('/', (_req: express.Request, res: express.Response) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to Bus Tracking API',
        version: '1.0.0',
        docs: '/api/docs' // Future documentation path
    });
});

/**
 * Health check endpoint
 */
app.get('/health', (_req: express.Request, res: express.Response) => {
    res.status(200).json({
        success: true,
        message: 'Server is healthy',
        timestamp: new Date().toISOString(),
    });
});

/**
 * API Routes
 */
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

/**
 * 404 handler
 */
app.use(notFoundHandler);

/**
 * Error handler (must be last)
 */
app.use(errorHandler);

export default app;
