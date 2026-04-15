import { Request, Response } from 'express';
import { asyncHandler } from '../../middleware/errorHandler';
import * as busesService from './buses.service';
import { createBusSchema, updateBusSchema, assignDriverSchema } from './buses.validation';

/**
 * List all buses
 * GET /api/buses
 */
export const listBuses = asyncHandler(async (req: Request, res: Response) => {
    const buses = await busesService.getAllBuses();

    res.status(200).json({
        success: true,
        data: buses,
    });
});

/**
 * Get bus details
 * GET /api/buses/:id
 */
export const getBus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const bus = await busesService.getBusById(id);

    res.status(200).json({
        success: true,
        data: bus,
    });
});

/**
 * Create a new bus
 * POST /api/buses
 */
export const createBus = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = createBusSchema.parse(req.body);
    const bus = await busesService.createBus(validatedData);

    res.status(201).json({
        success: true,
        message: 'Bus created successfully',
        data: bus,
    });
});

/**
 * Update bus details
 * PUT /api/buses/:id
 */
export const updateBus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const validatedData = updateBusSchema.parse(req.body);

    const updatedBus = await busesService.updateBus(id, validatedData);

    res.status(200).json({
        success: true,
        message: 'Bus updated successfully',
        data: updatedBus,
    });
});

/**
 * Delete a bus
 * DELETE /api/buses/:id
 */
export const deleteBus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await busesService.deleteBus(id);

    res.status(200).json({
        success: true,
        message: 'Bus deleted successfully',
    });
});

/**
 * Assign a driver to a bus
 * POST /api/buses/:id/assign-driver
 */
export const assignDriver = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // busId
    const { driverId } = assignDriverSchema.parse(req.body);

    const updatedDriver = await busesService.assignDriverToBus(id, driverId);

    res.status(200).json({
        success: true,
        message: 'Driver assigned successfully',
        data: updatedDriver,
    });
});
