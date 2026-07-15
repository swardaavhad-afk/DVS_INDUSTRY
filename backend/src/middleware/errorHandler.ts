import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors';
import { logger } from '../logger';
import { env } from '../config/env';
import { HTTP_STATUS } from '../constants';

/**
 * Global Express error-handling middleware.
 * Must be registered LAST — after all routes and other middleware.
 * Express identifies it as an error handler by the 4-argument signature.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // ── Zod validation errors ──────────────────────────────────────
  if (err instanceof ZodError) {
    const details = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(HTTP_STATUS.UNPROCESSABLE).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details,
      },
    });
    return;
  }

  // ── Operational errors (AppError subclasses) ───────────────────
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error('Non-operational AppError', { err, req: req.path });
    }

    const body: Record<string, unknown> = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    };

    if (err instanceof ValidationError && err.details !== undefined) {
      (body['error'] as Record<string, unknown>)['details'] = err.details;
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // ── Unknown / programming errors ───────────────────────────────
  logger.error('Unhandled error', {
    err,
    stack: err instanceof Error ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      // Hide internal details from clients in production
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err instanceof Error
            ? err.message
            : String(err),
    },
  });
}
