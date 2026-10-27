/**
 * Standardised JSON response helpers.
 */

/**
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {object} [data]
 */
export function sendJson(res, statusCode, data = {}) {
  return res.status(statusCode).json(data);
}

export function ok(res, data) {
  return sendJson(res, 200, data);
}

export function created(res, data) {
  return sendJson(res, 201, data);
}

export function accepted(res, data) {
  return sendJson(res, 202, data);
}

export function notFound(res, message = 'Not found') {
  return sendJson(res, 404, { error: message });
}

export function badRequest(res, message = 'Bad request') {
  return sendJson(res, 400, { error: message });
}

export function serverError(res, message = 'Internal server error') {
  return sendJson(res, 500, { error: message });
}