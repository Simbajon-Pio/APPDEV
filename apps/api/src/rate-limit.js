import { createHash } from 'node:crypto';

const WINDOW_MS = 15 * 60 * 1000;
export function createIpRateLimiter({ limit, message = 'Too many requests. Try again later.', clock = () => Date.now() }) {
  const buckets = new Map();
  return (req, _res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = clock();
    let bucket = buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) bucket = { count: 0, expiresAt: now + WINDOW_MS };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 10000) for (const [ip, state] of buckets) if (state.expiresAt <= now) buckets.delete(ip);
    if (bucket.count > limit) return next(Object.assign(new Error(message), { status: 429, code: 'RATE_LIMITED' }));
    next();
  };
}

export function hashReferenceToken(reference) {
  return createHash('sha256').update(reference).digest('hex');
}
