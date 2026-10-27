import { config } from '../../config/env.js';

/**
 * Centralised error-handling middleware.
 * Must be registered *after* all routes.
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode ?? err.status ?? 500;
  const message = config.isProduction && statusCode === 500
    ? 'Internal server error'
    : err.message || 'Internal server error';

  // Safe logging — avoid dumping secrets.
  console.error(`[ERROR] ${statusCode} ${err.message}`);
  if (!config.isProduction) {
    console.error(err.stack);
  }

  res.status(statusCode).json({ error: message });
}

/**
 * Create a simple HTTP error with a status code.
 */
export function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}