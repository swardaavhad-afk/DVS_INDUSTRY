/**
 * Entry point — starts the HTTP server.
 *
 * Responsible for:
 *  1. Loading & validating environment variables (via env.ts import)
 *  2. Connecting the Prisma client
 *  3. Binding the Express app to a port
 *  4. Graceful shutdown on SIGTERM / SIGINT
 */

// dotenv must be loaded before anything else reads process.env
import 'dotenv/config';

import { env } from './config/env';
import app from './app';
import { prisma } from './lib/prismaClient';
import { logger } from './logger';

const server = app.listen(env.PORT, () => {
  logger.info(`🚀  Server running`, {
    port: env.PORT,
    env: env.NODE_ENV,
    pid: process.pid,
  });
});

// ── Graceful shutdown ──────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received — shutting down gracefully`);

  // Stop accepting new connections
  server.close(async () => {
    try {
      await prisma.$disconnect();
      logger.info('Prisma disconnected. Bye 👋');
      process.exit(0);
    } catch (err) {
      logger.error('Error during shutdown', { err });
      process.exit(1);
    }
  });

  // Force exit after 10 s if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err });
  process.exit(1);
});
