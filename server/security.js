import { consumeRateLimitFromDatabase, getUserById, revokeUserSessions } from './database.js';

import crypto from 'node:crypto';

const SESSION_COOKIE = 'cinematic_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MFA_STEP_SECONDS = 30;
const MFA_DIGITS = 6;
const buckets = new Map();

function authSecret() {
  return process.env.APP_SESSION_SECRET || '';
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, derived) => {
    if (error) return reject(error);
    resolve(salt + ':' + derived.toString('hex'));
  });
}

export function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected) return Promise.resolve(false);
  return new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 }, (error, derived) => {
    if (error) return reject(error);
    const actual = derived.toString('hex');
    resolve(actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)));
  });
}

function encryptionKey() { return crypto.createHash('sha256').update(authSecret()).digest(); }
export function encryptSecret(value) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
export function decryptSecret(value) {
  try { const [iv, tag, ciphertext] = String(value || '').split('.'); if (!iv || !tag || !ciphertext) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url')); decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch { return null; }
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
  return Boolean(process.env.APP_SESSION_SECRET && (process.env.APP_AUTH_PASSWORD || process.env.DATABASE_URL));
}

export function assertAuthConfigured() {
  if (!authConfigured() && !developmentBypassAllowed()) {
    throw new Error('Authentication is required in production. Set APP_SESSION_SECRET and either APP_AUTH_PASSWORD or DATABASE_URL.');
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
  const issuedAt = Date.now();
  const expires = issuedAt + SESSION_TTL_MS;
  const sessionId = crypto.randomBytes(18).toString('base64url');
  const payload = String(userId) + ':' + String(issuedAt) + ':' + String(expires) + ':' + sessionId;
  return payload + '.' + sign(payload);
}

export function verifySessionCookie(cookie) {
  if (!cookie) return null;
  const [payload, signature] = String(cookie).split('.');
  const parts = String(payload).split(':');
  const userId = parts[0] || 'admin';
  const issuedAt = Number(parts[1]);
  const expires = Number(parts[2]);
  const sessionId = parts[3] || '';
  if (!userId || !Number.isFinite(issuedAt) || !Number.isFinite(expires) || !sessionId || !signature || expires < Date.now()) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual) ? { userId, issuedAt, expires, sessionId } : null;
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
  if (req.authUserId) return req.authUserId;
  const cookies = parseCookies(req.headers.cookie || '');
  const session = verifySessionCookie(cookies[SESSION_COOKIE]);
  return session?.userId || null;
}

export async function isSessionActive(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const session = verifySessionCookie(cookies[SESSION_COOKIE]);
  if (!session) return false;
  if (session.userId === 'admin' || !process.env.DATABASE_URL) return true;
  const user = await getUserById(session.userId);
  if (!user) return false;
  return !user.sessions_revoked_at || new Date(user.sessions_revoked_at).getTime() < session.issuedAt;
}

export function setSessionCookie(res, userId = 'admin') {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(createSessionCookie(userId))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

export async function revokeCurrentSession(req) {
  const userId = getSessionUserId(req);
  if (userId && userId !== 'admin' && process.env.DATABASE_URL) await revokeUserSessions(userId);
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
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
  return async (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    let result = null;
    try {
      if (process.env.DATABASE_URL) result = await consumeRateLimitFromDatabase(key, { limit, windowMs });
    } catch {}
    if (!result) result = consumeRateLimit(key, { limit, windowMs });

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    if (!result.allowed) {
      res.setHeader('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    }
    return next();
  };
}

export async function authMiddleware(req, res, next) {
  if (!authConfigured()) {
    if (developmentBypassAllowed()) return next();
    return res.status(503).json({ error: 'Authentication is not configured on this server.' });
  }
  const auth = String(req.headers.authorization || '');
  if (auth.startsWith('Bearer ')) {
    const supplied = auth.slice(7).trim();
    const expected = process.env.APP_ACCESS_TOKEN || '';
    if (!expected || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.authUserId = null;
    req.authMethod = 'bearer';
    return next();
  }
  const cookies = parseCookies(req.headers.cookie || '');
  const session = verifySessionCookie(cookies[SESSION_COOKIE]);
  if (!session) return res.status(401).json({ error: 'Authentication required.' });
  if (session.userId !== 'admin' && process.env.DATABASE_URL) {
    const user = await getUserById(session.userId);
    if (!user || (user.sessions_revoked_at && new Date(user.sessions_revoked_at).getTime() >= session.issuedAt)) {
      return res.status(401).json({ error: 'Session has expired or been revoked.' });
    }
  }
  req.authUserId = session.userId;
  req.authMethod = 'session';
  return next();
}

export function randomBase32Secret(bytes = 20) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const data = crypto.randomBytes(bytes);
  let bits = 0; let value = 0; let out = '';
  for (const byte of data) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

function decodeBase32(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(secret || '').replace(/=+$/,'').toUpperCase().replace(/[^A-Z2-7]/g,'');
  let bits = 0; let value = 0; const out = [];
  for (const char of clean) {
    const index = alphabet.indexOf(char); if (index < 0) continue;
    value = (value << 5) | index; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function verifyTotp(secret, supplied, timestamp = Date.now()) {
  const code = String(supplied || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(code)) return false;
  const key = decodeBase32(secret);
  if (!key.length) return false;
  const counter = Math.floor(timestamp / 1000 / MFA_STEP_SECONDS);
  for (let offset = -1; offset <= 1; offset += 1) {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter + offset));
    const digest = crypto.createHmac('sha1', key).update(buffer).digest();
    const index = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[index] & 0x7f) << 24) | (digest[index + 1] << 16) | (digest[index + 2] << 8) | digest[index + 3];
    const expected = String(binary % 10 ** MFA_DIGITS).padStart(MFA_DIGITS, '0');
    if (secretsMatch(code, expected)) return true;
  }
  return false;
}

export function buildTotpUri(secret, email) {
  const issuer = 'Smart-BethG';
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email || 'account')}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function getPublicAuthStatus() {
  return { required: authConfigured(), mode: authConfigured() ? 'password-session' : (developmentBypassAllowed() ? 'development-open' : 'misconfigured') };
}
