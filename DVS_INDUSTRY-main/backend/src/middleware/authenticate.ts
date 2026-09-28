import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types';
import { verifyAccessToken } from '../utils/token';
import { UnauthorizedError } from '../errors';

/**
 * authenticate()
 *
 * Validates the Bearer access token in the Authorization header.
 * On success it attaches the decoded payload to `req.user`.
 * On failure it throws an UnauthorizedError which the global error
 * handler converts to a 401 response.
 *
 * Usage:
 *   router.get('/me', authenticate, handler)
 */
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];

  if (authHeader === undefined || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('No access token provided');
  }

  const token = authHeader.split(' ')[1];

  if (token === undefined || token.trim() === '') {
    throw new UnauthorizedError('Malformed authorization header');
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch {
    throw new UnauthorizedError('Access token is invalid or has expired');
  }
}
