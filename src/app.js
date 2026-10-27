import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { config } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { githubRouter } from './routes/github.routes.js';
import { reviewRouter } from './routes/review.routes.js';
import { webhookRouter } from './routes/webhook.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { ok } from './utils/response.js';

/**
 * Create the Express application.
 * Separated from server.js so tests can build the app with mocked services.
 */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // --- Security headers ---
  app.use(helmet());

  // --- CORS ---
  app.use(
    cors({
      origin: config.FRONTEND_URL.split(',').map((s) => s.trim()),
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    }),
  );

  // --- JSON body parsing (preserve raw body for webhook signature) ---
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        // Stash the raw buffer so the webhook handler can verify the HMAC.
        req.rawBody = buf;
      },
    }),
  );

  // --- Rate limiting (applies to /api only, not webhooks) ---
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });

  // --- Routes ---
  app.get('/health', async (_req, res) => {
    let database = 'ok';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'unavailable';
    }
    return ok(res, { status: 'ok', database, uptime: process.uptime() });
  });
  app.use('/api/github', apiLimiter, githubRouter);
  app.use('/api/reviews', apiLimiter, reviewRouter);
  app.use('/api/webhooks', webhookRouter);

  // --- 404 ---
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // --- Error handler (must be last) ---
  app.use(errorHandler);

  return app;
}