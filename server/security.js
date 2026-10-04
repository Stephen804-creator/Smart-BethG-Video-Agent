import crypto from 'node:crypto';

const SESSION_COOKIE = 'cinematic_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const buckets = new Map();

function authSecret() {
  return process.env.APP_SESSION_SECRET || '';
}

export function secretsMatch(supplied, expected) {
  const a = Buffer.from(String(supplied || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function developmentBypassAllowed() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_INSECURE_LOCAL === 'true';
}

export function authConfigured() {
  return Boolean(process.env.APP_AUTH_PASSWORD && process.env.APP_SESSION_SECRET);
}

export function assertAuthConfigured() {
  if (!authConfigured() && !developmentBypassAllowed()) {
    throw new Error('Authentication is required in production. Set APP_AUTH_PASSWORD and APP_SESSION_SECRET.');
  }
}

function sign(value) {
  return crypto.createHmac('sha256', authSecret()).update(value).digest('base64url');
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return [];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(Boolean));
}

export function createSessionCookie(userId = 'admin') {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = String(userId) + ':' + String(expires);
  return payload + '.' + sign(payload);
}

export function verifySessionCookie(cookie) {
  if (!cookie) return null;
  const [payload, signature] = String(cookie).split('.');
  const separator = String(payload).lastIndexOf(':');
  const userId = separator > 0 ? payload.slice(0, separator) : 'admin';
  const expires = separator > 0 ? payload.slice(separator + 1) : payload;
  if (!expires || !signature || Number(expires) < Date.now()) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual) ? { userId, expires: Number(expires) } : null;
}

export function isAuthenticated(req) {
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    const supplied = auth.slice(7).trim();
    const expected = process.env.APP_ACCESS_TOKEN || '';
    if (expected && supplied.length === expected.length) {
      return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
    }
  }
  const cookies = parseCookies(req.headers.cookie || '');
  return Boolean(verifySessionCookie(cookies[SESSION_COOKIE]));
}

export function getSessionUserId(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const session = verifySessionCookie(cookies[SESSION_COOKIE]);
  return session?.userId || null;
}

export function setSessionCookie(res, userId = 'admin') {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(createSessionCookie(userId))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export function consumeRateLimit(key, { limit = 60, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  return {
    allowed: bucket.count <= limit,
    remaining,
    retryAfterMs: Math.max(0, windowMs - (now - bucket.startedAt))
  };
}

export function rateLimitMiddleware({ limit, windowMs, keyPrefix }) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const result = consumeRateLimit(`${keyPrefix}:${ip}`, { limit, windowMs });
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }
    next();
  };
}

export function authMiddleware(req, res, next) {
  if (!authConfigured()) {
    if (developmentBypassAllowed()) return next();
    return res.status(503).json({ error: 'Authentication is not configured on this server.' });
  }
  if (isAuthenticated(req)) return next();
  return res.status(401).json({ error: 'Authentication required.' });
}

export function getPublicAuthStatus() {
  return { required: authConfigured(), mode: authConfigured() ? 'password-session' : (developmentBypassAllowed() ? 'development-open' : 'misconfigured') };
}
