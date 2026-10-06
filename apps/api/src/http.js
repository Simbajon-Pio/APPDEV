export class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export const validationError = (fields, message = 'Check the marked fields.') => new HttpError(422, 'VALIDATION_ERROR', message, fields);
export const conflictError = (message = 'The record changed. Reload before retrying.') => new HttpError(409, 'CONFLICT', message);
export const notFoundError = () => new HttpError(404, 'NOT_FOUND', 'The requested record was not found.');

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function sendData(res, data, status = 200) {
  return res.status(status).json({ data });
}

export function requireUser(req, _res, next) {
  if (!req.session?.user) return next(new HttpError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
  next();
}

export function enforceCsrf({ appOrigin }) {
  return (req, _res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const origin = req.get('Origin');
    if (!origin || origin !== appOrigin) return next(new HttpError(403, 'FORBIDDEN', 'Request origin is not allowed.'));
    if (req.path.startsWith('/api/public/')) return next();
    const supplied = req.get('X-CSRF-Token');
    if (!req.session?.csrfToken || !supplied || supplied.length !== req.session.csrfToken.length || supplied !== req.session.csrfToken) {
      return next(new HttpError(403, 'FORBIDDEN', 'A valid CSRF token is required.'));
    }
    next();
  };
}

export function errorHandler(error, _req, res, _next) {
  if (res.headersSent) return;
  if (error instanceof HttpError) {
    const envelope = { code: error.code, message: error.message };
    if (error.fields) envelope.fields = error.fields;
    return res.status(error.status).json({ error: envelope });
  }
  if (error?.status === 429 || error?.code === 'RATE_LIMITED') return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Try again later.' } });
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body is too large.' } });
  if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON.' } });
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } });
}
