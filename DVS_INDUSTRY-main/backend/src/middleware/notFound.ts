import type { Request, Response } from 'express';
import { HTTP_STATUS } from '../constants';

/**
 * 404 catch-all handler.
 * Register AFTER all routes, BEFORE the errorHandler.
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}
