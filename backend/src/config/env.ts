import { z } from 'zod';

/**
 * Validates all required environment variables at startup.
 * The app will crash immediately with a descriptive error if any are missing
 * or malformed — far better than silent failures at runtime.
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),

  // JWT Access Token
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),

  // JWT Refresh Token
  REFRESH_TOKEN_SECRET: z
    .string()
    .min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // Security
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

  // CORS — comma-separated list of allowed origins
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // Logging
  LOG_LEVEL: z
    .enum(['error', 'warn', 'info', 'http', 'debug'])
    .default('info'),
});

/**
 * Parsed and validated environment variables.
 * Import `env` instead of `process.env` throughout the app.
 */
function parseEnv(): z.infer<typeof envSchema> {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((e) => `  • ${e.path.join('.')}: ${e.message}`)
      .join('\n');

    // Crash intentionally — broken config must never reach runtime
    console.error('❌  Environment validation failed:\n' + formatted);
    process.exit(1);
  }

  return result.data;
}

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
