import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler } from './middleware/notFound';
import { errorHandler } from './middleware/errorHandler';
import router from './routes';

const app = express();

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow server-to-server requests (origin === undefined) in dev
      if (origin === undefined || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin '${origin}' not allowed`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// ── Global rate limiter ────────────────────────────────────────────────────
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500,                  // requests per window per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
    },
  }),
);

// ── Body parsing & compression ─────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(cookieParser());

// ── Request logging ────────────────────────────────────────────────────────
app.use(requestLogger);

// ── Static file serving — uploaded assets ─────────────────────────────────
app.use(
  '/uploads',
  express.static(path.resolve(process.cwd(), 'uploads'), {
    maxAge: '7d',
    etag:   true,
  }),
);

// ── Routes ─────────────────────────────────────────────────────────────────
app.use(router);

// ── 404 handler ───────────────────────────────────────────────────────────
app.use(notFoundHandler);

// ── Global error handler (must be last) ───────────────────────────────────
app.use(errorHandler);

export default app;
