import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';
import type { JwtAccessPayload, JwtRefreshPayload } from '../interfaces';

/**
 * Parse a JWT expires-in string (e.g. "15m", "7d") into milliseconds.
 */
export function parseExpiresInMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value);
  if (match === null) throw new Error(`Invalid expires-in format: ${value}`);
  const amount = parseInt(match[1] ?? '0', 10);
  const unit = match[2] ?? '';
  const multipliers: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] ?? 0);
}

export function generateAccessToken(payload: JwtAccessPayload): string {
  const { sub, email, role } = payload;
  // Pass options as a separate object — required by @types/jsonwebtoken
  return jwt.sign(
    { sub, email, role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

export function generateRefreshToken(payload: JwtRefreshPayload): string {
  const { sub, jti } = payload;
  return jwt.sign(
    { sub, jti },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: env.REFRESH_TOKEN_EXPIRES_IN } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): JwtAccessPayload {
  // Double-cast: jwt.verify returns string | JwtPayload; we own the payload shape
  return jwt.verify(token, env.JWT_SECRET) as unknown as JwtAccessPayload;
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  return jwt.verify(
    token,
    env.REFRESH_TOKEN_SECRET,
  ) as unknown as JwtRefreshPayload;
}

/** Cryptographically-random opaque token (for password reset). */
export function generateOpaqueToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

/** Unique token family ID for refresh tokens. */
export function generateJti(): string {
  return crypto.randomUUID();
}
