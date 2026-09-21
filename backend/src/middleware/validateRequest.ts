import type { Request, Response, NextFunction } from 'express';
import type { ZodObject, ZodRawShape, ZodError } from 'zod';

/**
 * Factory that returns an Express middleware which validates req.body,
 * req.params, and req.query against the provided Zod schemas.
 *
 * Usage:
 *   router.post('/users', validateRequest({ body: createUserSchema }), handler)
 *
 * On failure it calls next(zodError) which the global errorHandler converts
 * to a structured 422 response.
 */
export function validateRequest(schemas: {
  body?: ZodObject<ZodRawShape>;
  params?: ZodObject<ZodRawShape>;
  query?: ZodObject<ZodRawShape>;
}) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body !== undefined) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.params !== undefined) {
        // Cast required — Zod parse result is more specific than Express's ParamsDictionary
        req.params = (await schemas.params.parseAsync(req.params)) as typeof req.params;
      }
      if (schemas.query !== undefined) {
        const parsed = (await schemas.query.parseAsync(req.query)) as typeof req.query;
        // Express 5 makes req.query a getter — use Object.assign to merge parsed values
        Object.assign(req.query, parsed);
      }
      next();
    } catch (err) {
      next(err as ZodError);
    }
  };
}
