import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createDatabasePool } from './db.js';
import { createSessionMiddleware, MySQLSessionStore } from './session-store.js';
import { enforceCsrf, errorHandler, HttpError } from './http.js';
import { apiRouter } from './routes.js';
import { createIpRateLimiter } from './rate-limit.js';

export function createApp({ pool = createDatabasePool(), env = process.env, sessionStore } = {}) {
  const app = express();
  const appOrigin = env.APP_ORIGIN || 'http://localhost:5173';
  const appUrl = env.PUBLIC_APP_URL || appOrigin;
  const isProduction = env.NODE_ENV === 'production';
  if (isProduction && (!env.SESSION_SECRET || Buffer.byteLength(env.SESSION_SECRET) < 32)) {
    throw new Error('SESSION_SECRET must contain at least 32 bytes in production.');
  }
  const store = sessionStore || new MySQLSessionStore(pool);
  const sessionMiddleware = createSessionMiddleware({
    pool,
    secret: env.SESSION_SECRET || 'local-only-insecure-session-secret-change-before-hosting',
    secure: isProduction,
    store
  });
  app.locals.pool = pool;
  app.locals.sessionStore = store;
  app.disable('x-powered-by');
  app.set('trust proxy', isProduction ? 1 : false);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.path.startsWith('/api/public/')) {
      const origin = req.get('Origin');
      if (!origin || origin !== appOrigin) return next(new HttpError(403, 'FORBIDDEN', 'Request origin is not allowed.'));
    }
    next();
  });
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use(sessionMiddleware);
  app.use(enforceCsrf({ appOrigin }));
  const loginLimiter = createIpRateLimiter({ limit: 10 });
  const publicLimiter = createIpRateLimiter({ limit: 5 });
  app.use('/api', apiRouter({ pool, appUrl, loginLimiter, publicLimiter }));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.')));

  const webDist = env.WEB_DIST_PATH ? resolve(env.WEB_DIST_PATH) : '';
  if (webDist && existsSync(webDist)) {
    app.use(express.static(webDist, { index: false, maxAge: isProduction ? '1h' : 0 }));
    app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
      const index = join(webDist, 'index.html');
      if (!existsSync(index)) return next();
      res.sendFile(index);
    });
  }
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'The requested resource was not found.')));
  app.use(errorHandler);
  return app;
}
