import type { Response } from 'express';

/**
 * Consistent API response envelope.
 *
 * Success:  { success: true,  data: T,       message?: string, meta?: M }
 * Failure:  { success: false, error: { code, message, details? } }
 */

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiSuccessResponse<T, M extends ApiMeta = ApiMeta> {
  success: true;
  data: T;
  message?: string;
  meta?: M;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T, M extends ApiMeta = ApiMeta> =
  | ApiSuccessResponse<T, M>
  | ApiErrorResponse;

// ── Helpers ────────────────────────────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string,
  meta?: ApiMeta,
): void {
  const body: ApiSuccessResponse<T> = { success: true, data };
  if (message !== undefined) body.message = message;
  if (meta !== undefined) body.meta = meta;
  res.status(statusCode).json(body);
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, 201, message);
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
