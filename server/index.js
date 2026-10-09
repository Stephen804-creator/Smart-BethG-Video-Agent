import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import crypto from 'node:crypto';
import { Client, handle_file } from '@gradio/client';
import { findGeneration } from './continuity.js';
import { generateWithLuma } from './luma.js';
import { listProviders } from './router/provider-registry.js';
import { chooseProvider } from './router/scorer.js';
import { getComfyHealth } from './comfyui.js';
import { createComfyWorker } from './workers/comfyui-worker.js';
import { normalizeMediaTask, validateMediaTask } from './workers/media-task.js';
import { prepareExecutionPlan } from './workers/execution-planner.js';
import { createProductionRunner } from './orchestration/production-runner.js';
import { createJobQueue } from './jobs/queue.js';
import { searchKnowledge, getKnowledgeEntry, listKnowledgeDomains, getKnowledgeForTask, validateKnowledgeReferences } from './knowledge/base.js';
import { normalizeSoundPlan } from './sound/schema.js';
import { evaluateVideoFile } from './evaluation/video-qc.js';
import { validateGenerateInput, validateMediaGenerateInput, validateProductionGraphInput } from './validation.js';
import { buildMediaPlan } from './planning/media-planner.js';
import { buildFormatProductionPlan } from './planning/format-production-planner.js';
import { buildStoryPlan } from './planning/story-planner.js';
import { createFilmStore } from './film-production.js';
import { createAssetStore } from './assets.js';
import { listMediaFormats, getMediaFormat } from './media/formats.js';
import { initDatabase, saveGenerationToDatabase, getDatabaseStatus, upsertWorldEntities, recordEntityEvent, getEntityState, resolveEntityStateAt, saveFilmProjectToDatabase, getFilmProjectFromDatabase, listFilmProjectsFromDatabase, listGenerationsFromDatabase, getGenerationFromDatabase, saveJobToDatabase, listJobsFromDatabase, createUser, getUserByEmail, getUserById, claimJob, heartbeatJob, releaseJobClaim, recoverableJobsFromDatabase, revokeUserSessions, updateUserMfa, createPasswordResetToken, consumePasswordResetToken, updateUserPassword } from './database.js';
import { assertAuthConfigured, authMiddleware, clearSessionCookie, getPublicAuthStatus, isAuthenticated, isSessionActive, getSessionUserId, rateLimitMiddleware, secretsMatch, setSessionCookie, revokeCurrentSession, hashPassword, verifyPassword, randomBase32Secret, verifyTotp, buildTotpUri, encryptSecret, decryptSecret } from './security.js';
import { assertSafeComfyUrl, fetchSafeExternalMedia } from './security/outbound.js';
import { renderShot, renderTimeline } from './render/ffmpeg.js';
import { canonicalOutputUri, resolveMediaPath } from './media/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const configuredTrustProxy = process.env.APP_TRUST_PROXY === 'false' ? false : Number(process.env.APP_TRUST_PROXY || (process.env.NODE_ENV === 'production' ? 1 : 0));
app.set('trust proxy', configuredTrustProxy);
const port = Number(process.env.PORT || 8787);
const outputDir = path.join(root, 'output');
const dataDir = path.join(root, 'data');
const jobsFile = path.join(dataDir, 'production-jobs.jsonl');
const filmStore = createFilmStore(path.join(dataDir, 'film-projects.json'));

// PostgreSQL is the canonical durable store when DATABASE_URL is configured.
const filmMutationMethods = ['createProject','updateProject','updateStory','addCharacter','updateCharacter','updateWorld','addScene','updateScene','addShot','updateShot','reorderScene','reorderShot','addTake','selectTake','addAsset','updateAsset','attachAssetToShot','attachAssetToTake','addContinuityEvent'];
const assetDir = path.join(dataDir, 'assets');
const assetStore = createAssetStore({ rootDir: assetDir });
const upload = multer({
  dest: path.join(dataDir, 'upload-tmp'),
  limits: { fileSize: 500 * 1024 * 1024, files: 1, fieldNameSize: 100, fileNameSize: 255 },
  fileFilter: (req, file, cb) => {
    const allowedByExtension = new Map([
      ['.mp4', new Set(['video/mp4'])],
      ['.mov', new Set(['video/quicktime'])],
      ['.webm', new Set(['video/webm'])],
      ['.mkv', new Set(['video/x-matroska', 'video/matroska'])],
      ['.avi', new Set(['video/x-msvideo', 'video/avi'])],
      ['.mpeg', new Set(['video/mpeg'])],
      ['.mpg', new Set(['video/mpeg'])],
      ['.m4v', new Set(['video/x-m4v', 'video/mp4'])]
    ]);
    const originalName = String(file.originalname || '');
    const ext = path.extname(originalName).toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    const safeName = originalName.length <= 255 &&
      !/[\\\/:\x00-\x1f\x7f]/.test(originalName) &&
      path.basename(originalName) === originalName;
    if (!safeName || !allowedByExtension.has(ext) || !allowedByExtension.get(ext).has(mime)) {
      return cb(new Error('Unsupported media type. Upload a permitted video format.'));
    }
    cb(null, true);
  }
});
const comfyWorkflowPath = process.env.COMFYUI_WORKFLOW_PATH ? path.resolve(root, process.env.COMFYUI_WORKFLOW_PATH) : '';
const authRateLimit = rateLimitMiddleware({ limit: 60, windowMs: 15 * 60 * 1000, keyPrefix: 'auth' });
const generationRateLimit = rateLimitMiddleware({ limit: 5, windowMs: 10 * 60 * 1000, keyPrefix: 'generation' });
const workerId = process.env.WORKER_ID || `cinematic-${process.pid}-${Math.random().toString(36).slice(2, 10)}`;
const generationQueue = createJobQueue({
  concurrency: Number(process.env.GENERATION_CONCURRENCY || 1),
  maxQueue: Number(process.env.GENERATION_MAX_QUEUE || 10),
  onChange: job => { void saveJobToDatabase(job).catch(error => console.error('Job persistence failed:', error?.message || error)); },
  claim: (id, ownerUserId) => claimJob(id, ownerUserId, workerId),
  heartbeat: id => heartbeatJob(id, workerId),
  release: id => releaseJobClaim(id, workerId)
});
const apiRateLimit = rateLimitMiddleware({ limit: 120, windowMs: 60 * 1000, keyPrefix: 'api' });

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
const uploadTmpDir = path.join(dataDir, 'upload-tmp');
fs.mkdirSync(uploadTmpDir, { recursive: true });
try {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const name of fs.readdirSync(uploadTmpDir)) {
    const file = path.join(uploadTmpDir, name);
    try { if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file); } catch {}
  }
} catch {}

const allowedOrigins = String(process.env.APP_ALLOWED_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x => x.trim()).filter(Boolean);
const paidGenerationAllowed = process.env.ALLOW_PAID_GENERATION === 'true';
const renderJobTimeoutMs = Math.min(Math.max(Number(process.env.RENDER_JOB_TIMEOUT_MS || 10 * 60 * 1000), 30_000), 30 * 60 * 1000);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:");
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});
app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : false, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '2mb' }));
app.use('/output', authMiddleware, express.static(outputDir));
const servedAssetExtensions = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi', '.mpeg', '.mpg', '.m4v']);
function secureAssetStatic(req, res, next) {
  const filename = path.basename(req.path);
  const candidate = path.resolve(assetDir, filename);
  if (!servedAssetExtensions.has(path.extname(filename).toLowerCase()) || !candidate.startsWith(assetDir + path.sep) || !fs.existsSync(candidate)) return next();
  return authMiddleware(req, res, () => {
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return express.static(assetDir, { fallthrough: false })(req, res, next);
  });
}
app.use('/assets', secureAssetStatic);
app.use('/media-assets', secureAssetStatic);

app.get('/api/health', async (req, res) => {
  const database = await getDatabaseStatus();
  res.json({ ok: true, service: 'cinematic-agent-v1', database });
});

app.get('/api/auth/status', async (req, res) => {
  const authenticated = await isSessionActive(req);
  const userId = authenticated ? getSessionUserId(req) : null;
  const user = userId && userId !== 'admin' ? await getUserById(userId) : (userId === 'admin' ? { id: 'admin', email: null, displayName: 'Administrator' } : null);
  res.json({ ...getPublicAuthStatus(), registration: Boolean(process.env.DATABASE_URL), authenticated, user: user ? { id: user.id, email: user.email, displayName: user.display_name || user.displayName, mfaEnabled: Boolean(user.mfa_enabled) } : null });
});

app.post('/api/auth/register', authRateLimit, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return res.status(400).json({ error: 'Registration details are invalid.' });
    const existing = await getUserByEmail(email);
    const passwordHash = await hashPassword(password);
    if (!existing) await createUser({ email, passwordHash, displayName });
    res.status(202).json({ message: 'If registration is available, you can sign in with the account details provided.' });
  } catch (error) {
    res.status(400).json({ error: 'Could not complete registration.' });
  }
});

app.post('/api/auth/login', authRateLimit, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const supplied = String(req.body?.password || '');
  if (process.env.DATABASE_URL) {
    const user = await getUserByEmail(email);
    const passwordValid = user ? await verifyPassword(supplied, user.password_hash) : await hashPassword(supplied, '00000000000000000000000000000000');
    if (!user || !passwordValid) return res.status(401).json({ error: 'Invalid email or password.' });
    if (user.mfa_enabled) {
      const secret = decryptSecret(user.mfa_secret);
      if (!secret || !verifyTotp(secret, req.body?.mfaCode)) return res.status(401).json({ error: 'MFA verification required.', code: 'MFA_REQUIRED' });
    }
    setSessionCookie(res, user.id);
    return res.json({ authenticated: true, user: { id: user.id, email: user.email, displayName: user.display_name, mfaEnabled: Boolean(user.mfa_enabled) } });
  }
  if (!process.env.APP_AUTH_PASSWORD) return res.status(503).json({ error: 'Authentication is not configured.' });
  if (!secretsMatch(supplied, String(process.env.APP_AUTH_PASSWORD))) return res.status(401).json({ error: 'Invalid password.' });
  setSessionCookie(res, 'admin');
  res.json({ authenticated: true, user: { id: 'admin', email: null, displayName: 'Administrator' } });
});

app.post('/api/auth/logout', async (req, res) => {
  try { await revokeCurrentSession(req); } catch {}
  clearSessionCookie(res);
  res.json({ authenticated: false });
});

app.post('/api/auth/mfa/setup', authMiddleware, async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId || userId === 'admin') return res.status(400).json({ error: 'MFA requires a database user account.' });
  const user = await getUserById(userId);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  const secret = randomBase32Secret();
  await updateUserMfa(userId, { secret: encryptSecret(secret), enabled: false });
  res.json({ secret, otpauthUri: buildTotpUri(secret, user.email), enabled: false });
});

app.post('/api/auth/mfa/enable', authMiddleware, async (req, res) => {
  const userId = getSessionUserId(req);
  const user = userId && userId !== 'admin' ? await getUserById(userId) : null;
  const secret = decryptSecret(user?.mfa_secret);
  if (!user || !secret || !verifyTotp(secret, req.body?.code)) return res.status(400).json({ error: 'Invalid MFA code.' });
  await updateUserMfa(userId, { secret: user.mfa_secret, enabled: true });
  await revokeUserSessions(userId);
  res.json({ enabled: true });
});

app.post('/api/auth/mfa/disable', authMiddleware, async (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId || userId === 'admin') return res.status(400).json({ error: 'MFA is unavailable for this account.' });
  const user = await getUserById(userId);
  const secret = decryptSecret(user?.mfa_secret);
  if (!user || !secret || !verifyTotp(secret, req.body?.code)) return res.status(400).json({ error: 'Invalid MFA code.' });
  await updateUserMfa(userId, { secret: null, enabled: false });
  await revokeUserSessions(userId);
  clearSessionCookie(res);
  res.json({ enabled: false });
});

app.post('/api/auth/password-reset/request', authRateLimit, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const generic = { message: 'If the account exists, a password reset message will be sent.' };
  try {
    const user = await getUserByEmail(email);
    await hashPassword('password-reset-timing-placeholder', '00000000000000000000000000000000');
    if (user && process.env.PASSWORD_RESET_WEBHOOK_URL) {
      const token = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await createPasswordResetToken({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 15 * 60 * 1000) });
      const base = String(process.env.APP_PASSWORD_RESET_URL_BASE || '');
      if (!base || (process.env.NODE_ENV === 'production' && !base.startsWith('https://'))) throw new Error('Password reset delivery is not configured safely.');
      const resetUrl = base + (base.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
      const webhook = String(process.env.PASSWORD_RESET_WEBHOOK_URL);
      if (process.env.NODE_ENV === 'production' && !webhook.startsWith('https://')) throw new Error('Password reset delivery requires HTTPS in production.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const delivery = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, resetUrl }), signal: controller.signal }).finally(() => clearTimeout(timeout));
      if (!delivery.ok) throw new Error('Password reset delivery failed.');
    }
  } catch {}
  res.status(202).json(generic);
});

app.post('/api/auth/password-reset/complete', authRateLimit, async (req, res) => {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  if (!token || password.length < 8) return res.status(400).json({ error: 'Reset details are invalid.' });
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const userId = await consumePasswordResetToken(tokenHash);
  if (!userId) return res.status(400).json({ error: 'The reset token is invalid or expired.' });
  const passwordHash = await hashPassword(password);
  await updateUserPassword(userId, passwordHash);
  res.json({ passwordReset: true });
});
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return authMiddleware(req, res, () => apiRateLimit(req, res, next));
});

async function getOwnedProject(projectId, userId) {
  if (!projectId || !userId || userId === 'admin') return null;
  if (process.env.DATABASE_URL) {
    // PostgreSQL is authoritative: a stale in-memory project must not revive
    // access after its owner changes or its canonical row disappears.
    const canonical = await getFilmProjectFromDatabase(projectId, userId);
    if (!canonical) return null;
    filmStore.replaceProjects([canonical]);
  }
  const project = filmStore.getProject(projectId);
  return project && project.ownerUserId === userId ? project : null;
}

async function requireProjectAccess(req, res, next) {
  try {
    const userId = getSessionUserId(req);
    if (!userId || req.authMethod === 'bearer') return res.status(401).json({ error: 'A user session is required for this resource.' });
    const project = await getOwnedProject(req.params.projectId, userId);
    if (!project || project.ownerUserId !== userId) return res.status(404).json({ error: 'Film project not found.' });
    req.filmProject = project;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Could not verify project access.' });
  }
}

function requireUserIdentity(req, res, next) {
  const userId = getSessionUserId(req);
  if (!userId || req.authMethod === 'bearer') return res.status(401).json({ error: 'A user session is required for this resource.' });
  req.authUserId = userId;
  next();
}

app.use('/api/film', requireUserIdentity);
app.use('/api/projects', requireUserIdentity);
app.use('/api/jobs', requireUserIdentity);
app.use('/api/generations', requireUserIdentity);
app.use('/api/production', requireUserIdentity);

app.use('/api/film/projects/:projectId', requireProjectAccess);
app.use('/api/projects/:projectId', requireProjectAccess);

app.get('/api/jobs/:jobId', (req, res) => {
  const job = generationQueue.ownedGet(req.params.jobId, getSessionUserId(req));
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job });
});
app.get('/api/jobs/:jobId/events', (req, res) => {
  const job = generationQueue.ownedGet(req.params.jobId, getSessionUserId(req));
  if (!job) return res.status(404).json({ error: 'Job not found.' });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const cleanup = generationQueue.subscribe(req.params.jobId, res);
  const heartbeat = setInterval(() => {
    try { res.write(': keep-alive\n\n'); } catch {}
  }, 20_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    cleanup();
  });
});

app.get('/api/jobs/:jobId/cost', (req, res) => {
  const job = generationQueue.ownedGet(req.params.jobId, getSessionUserId(req));
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  const generation = job.result?.generation || null;
  res.json({
    jobId: job.id,
    estimatedCostUsd: generation?.estimatedCostUsd ?? generation?.estimated_cost_usd ?? null,
    actualCostUsd: generation?.actualCostUsd ?? generation?.actual_cost_usd ?? null,
    provider: generation?.provider || null
  });
});

app.post('/api/jobs/:jobId/cancel', (req, res) => {
  const job = generationQueue.ownedCancel(req.params.jobId, getSessionUserId(req));
  if (!job) return res.status(404).json({ error: 'Job not found.' });
  res.json({ job });
});
app.post('/api/jobs/:jobId/retry', (req, res) => {
  try {
    const job = generationQueue.ownedRetry(req.params.jobId, getSessionUserId(req));
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.status(202).json({ status: 'Queued', job });
  } catch (error) {
    res.status(error?.statusCode || 400).json({ error: error?.message || 'Could not retry job.' });
  }
});

function readSettings() {
  return {
    hfSpace: process.env.HF_SPACE || 'Lightricks/ltx-video-distilled',
    hfToken: process.env.HF_TOKEN || '',
    lumaApiKey: process.env.LUMAAI_API_KEY || '',
    lumaModel: ['ray-flash-2', 'ray-2'].includes(process.env.LUMA_MODEL) ? process.env.LUMA_MODEL : 'ray-flash-2',
    comfyUrl: process.env.COMFYUI_URL || 'http://127.0.0.1:8188',
    comfyModelProfile: process.env.COMFYUI_MODEL_PROFILE || ''
  };
}

function dimensionsForRatio(ratio) {
  const dimensions = {
    '16:9': { height: 512, width: 896 },
    '9:16': { height: 896, width: 512 },
    '1:1': { height: 640, width: 640 },
    '4:3': { height: 576, width: 768 },
    '3:4': { height: 768, width: 576 },
    '21:9': { height: 384, width: 896 },
    '9:21': { height: 896, width: 384 }
  };
  return dimensions[ratio] || dimensions['16:9'];
}

function getVideoResult(data) {
  if (!Array.isArray(data)) return null;
  const first = data[0];
  if (first && typeof first === 'object' && first.video) return first.video;
  if (first && typeof first === 'object' && (first.url || first.path)) return first;
  return null;
}

function validateUploadedVideo(filepath) {
  return new Promise((resolve, reject) => {
    const probe = spawn('ffprobe', ['-protocol_whitelist', 'file', '-format_whitelist', 'mov,matroska,webm,avi,mpegvideo', '-max_alloc', '100000000', '-analyzeduration', '10000000', '-probesize', '10000000', '-v', 'error', '-show_entries', 'format=format_name', '-of', 'default=noprint_wrappers=1:nokey=1', filepath]);
    let output = '';
    const timer = setTimeout(() => { probe.kill('SIGKILL'); reject(new Error('Uploaded media validation timed out.')); }, 30_000);
    probe.stdout.on('data', chunk => { output += chunk.toString(); });
    probe.on('error', error => { clearTimeout(timer); reject(error); });
    probe.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error('The uploaded file is not a valid supported video.'));
      const formats = new Set(output.trim().split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
      const allowed = ['mov','mp4','matroska','webm','avi','mpeg'];
      if (!allowed.some(format => formats.has(format))) return reject(new Error('The uploaded file format is not allowed.'));
      resolve(true);
    });
  });
}

function probeDuration(filepath) {
  return new Promise((resolve) => {
    const probe = spawn('ffprobe', ['-protocol_whitelist', 'file', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filepath]);
    let output = '';
    let settled = false;
    const finish = value => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => {
      try { probe.kill('SIGKILL'); } catch {}
      finish(null);
    }, 30_000);
    probe.stdout.on('data', chunk => { output += chunk.toString(); });
    probe.on('error', () => finish(null));
    probe.on('close', code => {
      if (code !== 0) return finish(null);
      const seconds = Number.parseFloat(output.trim());
      finish(Number.isFinite(seconds) ? Number(seconds.toFixed(3)) : null);
    });
  });
}

async function finalizeGeneratedMedia({ record, task, result, worker }) {
  const relative = String(record.output || '').replace(/^\/output\//, '');
  const filePath = path.join(outputDir, path.basename(relative));
  let evaluation = {};
  try {
    evaluation = await evaluateVideoFile(filePath, {
      requestedDuration: task.requirements?.duration || null,
      frameOutputRoot: path.join(dataDir, 'evaluation-frames')
    });
  } catch (error) {
    evaluation = { decision: 'UNAVAILABLE', findings: [{ severity: 'REVIEW', code: 'QC_UNAVAILABLE', message: error?.message || 'Quality control unavailable.' }] };
  }

  record.qualityControl = evaluation;
  let database = { enabled: false, persisted: false };
  try {
    const persisted = await saveGenerationToDatabase(record);
    database = { enabled: Boolean(process.env.DATABASE_URL), persisted: Boolean(persisted) };
  } catch (error) {
    database = { enabled: true, persisted: false, detail: error?.message || 'Database write failed.' };
    console.error('Generation artifact persisted locally; database write failed:', error);
  }

  return { evaluation, database, generationId: record.id };
}

function estimateGenerationCost({ provider, duration }) {
  const seconds = Number(duration || 0);
  if (provider === 'huggingface') return { estimatedUsd: 0, source: 'public-free-quota' };
  if (provider === 'luma') {
    const rate = Number(process.env.LUMA_COST_USD_PER_SECOND || 0);
    return { estimatedUsd: rate > 0 ? Number((seconds * rate).toFixed(6)) : null, source: rate > 0 ? 'configured-rate' : 'provider-rate-not-configured' };
  }
  if (provider === 'comfyui') {
    const hourly = Number(process.env.COMFYUI_COST_USD_PER_HOUR || 0);
    return { estimatedUsd: hourly > 0 ? Number((seconds / 3600 * hourly).toFixed(6)) : null, source: hourly > 0 ? 'configured-rate' : 'user-controlled-runtime' };
  }
  return { estimatedUsd: null, source: 'unknown' };
}

function buildShotPrompt({ prompt, framing, cameraMovement, lighting }) {
  const controls = [
    `Framing: ${framing || 'medium shot'}.`,
    `Camera movement: ${cameraMovement || 'slow push-in'}.`,
    `Lighting: ${lighting || 'natural cinematic'}.`
  ];
  return [
    'Single continuous cinematic shot.',
    prompt.trim(),
    ...controls,
    'Keep the main subject, environment and visual identity consistent throughout the shot. Do not introduce a new scene or unrelated subjects.'
  ].join(' ');
}

async function runLtxJob(client, endpoint, payload, timeoutMs = 15 * 60 * 1000, signal = null) {
  if (signal?.aborted) throw signal.reason || Object.assign(new Error('Operation cancelled.'), { name: 'AbortError' });
  const job = client.submit(endpoint, payload);
  let finalData = null;
  let lastStatus = null;
  const deadline = Date.now() + timeoutMs;

  try {
    for await (const message of job) {
      if (signal?.aborted) {
        try { await job.return?.(); } catch {}
        throw signal.reason || Object.assign(new Error('Operation cancelled.'), { name: 'AbortError' });
      }
      if (Date.now() > deadline) {
        try { await job.return?.(); } catch {}
        throw new Error(`LTX generation exceeded the ${Math.round(timeoutMs / 60000)} minute worker timeout.`);
      }
      if (message.type === 'status') lastStatus = message;
      if (message.type === 'data') finalData = message.data;
    }
  } finally {
    try { signal?.removeEventListener?.('abort', () => {}); } catch {}
  }

  if (!finalData) throw new Error(lastStatus?.message || 'LTX completed without returning a video.');
  return finalData;
}

async function generateWithLtx({ prompt, duration, ratio, framing, cameraMovement, lighting, referenceGenerationId, ownerUserId, projectId, sceneId, shotId, signal }) {
  const reference = referenceGenerationId ? await findGeneration(referenceGenerationId, ownerUserId) : null;
  const hasVisualReference = Boolean(reference?.output);
  const continuityPrompt = reference ? 'Preserve continuity with the previous shot. Character, clothing, location, lighting and visual identity must remain consistent.' : '';
  const shotPrompt = buildShotPrompt({ prompt: [continuityPrompt, prompt].filter(Boolean).join(' '), framing, cameraMovement, lighting });

  const settings = readSettings();
  const space = settings.hfSpace || 'Lightricks/ltx-video-distilled';
  const token = settings.hfToken || process.env.HF_TOKEN || undefined;
  const dimensions = dimensionsForRatio(ratio);
  const client = await Client.connect(space, { ...(token ? { token } : {}), events: ['status', 'data'] });
  const seed = Math.floor(Math.random() * 2147483647);
  let finalData;
  let mode = 'text-to-video';

  if (hasVisualReference) {
    const referencePath = resolveMediaPath(reference.output, { root, outputDir, assetDir });
    if (!referencePath || !fs.existsSync(referencePath)) throw new Error('The selected continuity video is no longer available on the server.');
    mode = 'video-to-video';
    const inputVideo = await handle_file(referencePath);
    finalData = await runLtxJob(client, '/video_to_video', [shotPrompt, 'worst quality, inconsistent motion, blurry, jittery, distorted', null, inputVideo, dimensions.height, dimensions.width, 'video-to-video', Number(duration), 9, seed, true, 1, true], 15 * 60 * 1000, signal);
  } else {
    finalData = await runLtxJob(client, '/text_to_video', [shotPrompt, 'worst quality, inconsistent motion, blurry, jittery, distorted', null, null, dimensions.height, dimensions.width, 'text-to-video', Number(duration), 9, seed, true, 1, true], 15 * 60 * 1000, signal);
  }

  const video = getVideoResult(finalData);
  if (!video?.url) throw new Error('LTX returned a result, but no downloadable video URL was provided.');
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.mp4`;
  const filepath = path.join(outputDir, filename);
  const bytes = await fetchSafeExternalMedia(video.url, { signal, maxBytes: 100 * 1024 * 1024, timeoutMs: 120_000 });
  fs.writeFileSync(filepath, bytes);
  const actualDuration = await probeDuration(filepath);
  const record = { id, ownerUserId: ownerUserId || null, projectId: projectId || null, sceneId: sceneId || null, shotId: shotId || null, createdAt: new Date().toISOString(), provider: 'huggingface', space, model: 'LTX Video 0.9.8 13B Distilled', mode, prompt, generatedPrompt: shotPrompt, referenceGenerationId: reference?.id || null, framing, cameraMovement, lighting, requestedDuration: Number(duration), duration: actualDuration ?? Number(duration), estimatedCostUsd: estimateGenerationCost({ provider: 'huggingface', duration: Number(duration) }).estimatedUsd, costSource: estimateGenerationCost({ provider: 'huggingface', duration: Number(duration) }).source, durationMeasured: actualDuration !== null, ratio, height: dimensions.height, width: dimensions.width, seed, output: `/output/${filename}` };
  const task = normalizeMediaTask({
    operation: mode === 'video-to-video' ? 'video-to-video' : 'text-to-video',
    prompt,
    duration: Number(duration),
    aspectRatio: ratio,
    requirements: { duration: Number(duration), aspectRatio: ratio, width: dimensions.width, height: dimensions.height, quality: 'standard' },
    continuity: { referenceGenerationId: reference?.id || null },
    metadata: { framing, cameraMovement, lighting, model: record.model }
  });
  const qualityControl = await finalizeGeneratedMedia({ record, task, result: { generationId: record.id }, worker: { id: 'huggingface-ltx', provider: 'huggingface', runtime: 'gradio-space' } });

  return { provider: 'Hugging Face • LTX Video', status: 'Completed', videoUrl: `/output/${filename}`, generation: record, qualityControl: qualityControl.evaluation, database: qualityControl.database };
}

async function generateLumaShot({ prompt, ratio, framing, cameraMovement, lighting, referenceGenerationId, model, ownerUserId, projectId, sceneId, shotId, signal }) {
  const settings = readSettings();
  const apiKey = settings.lumaApiKey || process.env.LUMAAI_API_KEY || '';
  const reference = referenceGenerationId ? await findGeneration(referenceGenerationId, ownerUserId) : null;
  const finalPrompt = buildShotPrompt({ prompt: [reference ? 'Preserve the established visual identity from the previous shot.' : '', prompt].filter(Boolean).join(' '), framing, cameraMovement, lighting });
  const { generation, videoUrl } = await generateWithLuma({ apiKey, prompt: finalPrompt, ratio, model: model || settings.lumaModel || 'ray-flash-2', signal });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.mp4`;
  const filepath = path.join(outputDir, filename);
  const bytes = await fetchSafeExternalMedia(videoUrl, { signal, maxBytes: 100 * 1024 * 1024, timeoutMs: 120_000 });
  fs.writeFileSync(filepath, bytes);
  const actualDuration = await probeDuration(filepath);
  const record = { id, ownerUserId: ownerUserId || null, createdAt: new Date().toISOString(), provider: 'luma', model: generation.model || model, mode: 'text-to-video', prompt, generatedPrompt: finalPrompt, referenceGenerationId: reference?.id || null, framing, cameraMovement, lighting, requestedDuration: null, duration: actualDuration, estimatedCostUsd: estimateGenerationCost({ provider: 'luma', duration: actualDuration || 5 }).estimatedUsd, costSource: estimateGenerationCost({ provider: 'luma', duration: actualDuration || 5 }).source, durationMeasured: actualDuration !== null, ratio, width: null, height: null, providerGenerationId: generation.id, output: `/output/${filename}` };
  const task = normalizeMediaTask({
    operation: 'text-to-video',
    prompt,
    duration: actualDuration || 5,
    aspectRatio: ratio,
    requirements: { duration: actualDuration || 5, aspectRatio: ratio, quality: 'standard' },
    metadata: { framing, cameraMovement, lighting, model: record.model }
  });
  const qualityControl = await finalizeGeneratedMedia({ record, task, result: { generationId: record.providerGenerationId }, worker: { id: 'luma-api', provider: 'luma', runtime: 'luma-api' } });
  return { provider: `Luma • ${record.model}`, status: 'Completed', videoUrl: `/output/${filename}`, generation: record, qualityControl: qualityControl.evaluation, database: qualityControl.database };
}


async function linkGenerationToFilmShot(input = {}, result = {}) {
  const projectId = input.projectId || input.metadata?.projectId;
  const ownerUserId = input.ownerUserId || input.metadata?.ownerUserId || null;
  if (!ownerUserId) throw new Error('An authenticated owner is required for generation persistence.');
  const shotId = input.shotId || input.metadata?.shotId;
  if (!projectId || !shotId || !result?.generation) return result;

  const videoUrl = result.videoUrl || result.generation.output?.asset || result.generation.output?.uri || result.generation.output || null;
  if (!videoUrl) return result;

  const filename = path.basename(String(videoUrl).split('?')[0]);
  const asset = filmStore.addAsset(projectId, {
    id: result.generation.id ? 'asset-' + result.generation.id : undefined,
    name: 'Generated Take ' + new Date().toISOString(),
    filename,
    sourceType: 'generated',
    uri: String(videoUrl),
    sceneId: result.generation.sceneId || null,
    shotId,
    mimeType: 'video/mp4',
    notes: JSON.stringify({
      generationId: result.generation.id || null,
      provider: result.generation.provider || result.provider || null,
      model: result.generation.model || null
    })
  });
  if (!asset) return result;

  const take = filmStore.addTake(projectId, {
    id: result.generation.id ? 'take-' + result.generation.id : undefined,
    shotId,
    assetId: asset.id,
    mediaUri: String(videoUrl),
    camera: result.generation.framing || input.framing || '',
    lens: result.generation.lens || '',
    notes: 'AI-generated take'
  });
  if (take) {
    filmStore.selectTake(projectId, shotId, take.id);
    await persistFilmProject(filmStore.getProject(projectId));
    result.film = { projectId, shotId, assetId: asset.id, takeId: take.id };
  }
  return result;
}
async function executeCanonicalGeneration(input = {}) {
  if (process.env.DATABASE_URL && !input.ownerUserId) throw new Error('An authenticated owner is required for generation.');
  const scopedProjectId = input.projectId || input.metadata?.projectId || null;
  const scopedShotId = input.shotId || input.metadata?.shotId || null;
  if (scopedProjectId && input.ownerUserId) {
    const ownedProject = await getOwnedProject(String(scopedProjectId), String(input.ownerUserId));
    if (!ownedProject) throw new Error('Film project not found.');
    if (scopedShotId && !(ownedProject.shots || []).some(shot => shot.id === scopedShotId)) throw new Error('Shot not found in this project.');
  }
  const requestedProvider = String(input.provider || input.providerId || 'auto');
  const operation = input.operation || 'text-to-video';
  const prompt = String(input.prompt || '').trim();
  const duration = Number(input.duration || input.requirements?.duration || 2);
  const ratio = String(input.ratio || input.aspectRatio || input.requirements?.aspectRatio || '16:9');
  const framing = input.framing || input.metadata?.framing || 'medium shot';
  const cameraMovement = input.cameraMovement || input.metadata?.cameraMovement || 'slow push-in';
  const lighting = input.lighting || input.metadata?.lighting || 'natural cinematic';
  const referenceGenerationId = input.referenceGenerationId || input.continuity?.referenceGenerationId || null;
  const allowPaid = paidGenerationAllowed;
  let selectedProvider = requestedProvider;
  if (!selectedProvider || selectedProvider === 'auto') {
    const settings = readSettings();
    const available = listProviders(settings);
    let comfy = { ok: false };
    try { comfy = await getComfyHealth(await assertSafeComfyUrl(settings.comfyUrl)); } catch {}
    const enriched = available.map(item => item.id === 'comfyui' ? { ...item, configured: comfy.ok, health: comfy } : item);
    const decision = chooseProvider(enriched, { task: operation, allowPaid, preferFree: !allowPaid, preferLocal: input.preferLocal !== false, purpose: input.purpose || 'production', continuation: Boolean(referenceGenerationId) });
    if (!decision.selected) throw new Error('No configured provider is available for this task. Paid providers are disabled unless explicitly allowed.');
    selectedProvider = decision.selected.id;
  }
  if ((selectedProvider === 'luma-ray-flash' || selectedProvider === 'luma-ray-2') && !allowPaid) throw new Error('Paid provider use is disabled. Explicitly enable paid generation before using Luma.');
  if (selectedProvider === 'huggingface-ltx') {
    if (operation !== 'text-to-video' && operation !== 'video-to-video') throw new Error('LTX currently supports text-to-video and continuity video-to-video in this pipeline.');
    const safeDuration = [2, 4, 6, 8].includes(Number(duration)) ? Number(duration) : 2;
    const safeRatio = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'].includes(ratio) ? ratio : '16:9';
    const result = await generateWithLtx({ prompt, duration: safeDuration, ratio: safeRatio, framing, cameraMovement, lighting, referenceGenerationId, ownerUserId: input.ownerUserId, projectId: input.projectId, sceneId: input.sceneId, shotId: input.shotId, signal: input.signal });
    return linkGenerationToFilmShot(input, result);
  }
  if (selectedProvider === 'luma-ray-flash' || selectedProvider === 'luma-ray-2') {
    if (operation !== 'text-to-video') throw new Error('Luma adapter currently supports text-to-video only.');
    const safeRatio = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'].includes(ratio) ? ratio : '16:9';
    const model = selectedProvider === 'luma-ray-2' ? 'ray-2' : 'ray-flash-2';
    const result = await generateLumaShot({ prompt, ratio: safeRatio, framing, cameraMovement, lighting, referenceGenerationId, model, ownerUserId: input.ownerUserId, projectId: input.projectId, sceneId: input.sceneId, shotId: input.shotId, signal: input.signal });
    if (result.generation) result.generation.ownerUserId = input.ownerUserId || null;
    return linkGenerationToFilmShot(input, result);
  }
  if (['comfyui', 'wan2.2-ti2v-5b', 'ltx-2.5', 'vace-wan'].includes(selectedProvider)) {
    const task = normalizeMediaTask({ ...input, operation, prompt, duration, aspectRatio: ratio, requirements: { ...(input.requirements || {}), duration, aspectRatio: ratio, quality: input.requirements?.quality || 'standard' }, metadata: { ...(input.metadata || {}), framing, cameraMovement, lighting } });
    validateMediaTask(task);
    const settings = readSettings();
    const safeComfyUrl = await assertSafeComfyUrl(settings.comfyUrl);
    const worker = await createComfyWorker({ baseUrl: safeComfyUrl, workflowPath: comfyWorkflowPath, outputDir });
    const generated = await worker.execute(task, { signal: input.signal });
    const record = { id: 'gen-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8), ownerUserId: input.ownerUserId || null, createdAt: new Date().toISOString(), domain: task.domain, operation: task.operation, provider: 'comfyui', workerId: worker.id, model: task.metadata.model || null, workflow: comfyWorkflowPath || null, prompt: task.prompt, requirements: task.requirements, output: generated.output, promptId: generated.promptId, source: generated.source, estimatedCostUsd: estimateGenerationCost({ provider: 'comfyui', duration: task.requirements.duration }).estimatedUsd, costSource: estimateGenerationCost({ provider: 'comfyui', duration: task.requirements.duration }).source };
    const qualityControl = await finalizeGeneratedMedia({ record, task, result: generated, worker: { id: worker.id, provider: 'comfyui', runtime: worker.runtime } });
    return linkGenerationToFilmShot(input, { provider: 'ComfyUI • Open Models', status: 'Completed', videoUrl: generated.output, generation: record, qualityControl: qualityControl.evaluation, database: qualityControl.database });
  }
  throw new Error('Unknown provider.');
}

async function executeTimelineExport({ projectId, ownerUserId }) {
  const project = await getOwnedProject(projectId, ownerUserId);
  if (!project) throw new Error('Film project not found.');
  const orderedShots = (project.shots || []).slice().sort((a, b) => {
    const sa = project.scenes?.find(s => s.id === a.sceneId)?.sequence || 0;
    const sb = project.scenes?.find(s => s.id === b.sceneId)?.sequence || 0;
    return sa - sb || (a.sequence || 0) - (b.sequence || 0);
  });
  const clips = [];
  for (const shot of orderedShots) {
    const take = (project.takes || []).find(t => t.id === shot.selectedTakeId) || (project.takes || []).find(t => t.shotId === shot.id);
    const asset = take?.assetId ? (project.assets || []).find(a => a.id === take.assetId) : null;
    if (!asset?.filename) continue;
    const inputPath = resolveMediaPath(asset.uri || asset.filename, { root, outputDir, assetDir });
    if (!inputPath || !fs.existsSync(inputPath)) continue;
    clips.push({ shotId: shot.id, inputPath, edit: shot.edit, effects: shot.effects, audioMix: shot.audioMix });
  }
  if (!clips.length) throw new Error('No usable selected takes are available for export.');
  const rendered = await renderTimeline({ clips, outputDir });
  const exportAsset = filmStore.addAsset(projectId, {
    id: 'export-' + path.basename(rendered.filename, '.mp4'),
    name: 'Timeline Export ' + new Date().toISOString(),
    filename: rendered.filename,
    sourceType: 'rendered-export',
    uri: rendered.output,
    mimeType: 'video/mp4',
    notes: JSON.stringify({ clipCount: rendered.clips?.length || 0, duration: rendered.duration })
  });
  const evaluation = await evaluateVideoFile(rendered.outputPath, { frameOutputRoot: path.join(dataDir, 'evaluation-frames') });
  await persistFilmProject(filmStore.getProject(projectId));
  return { export: rendered, asset: exportAsset, evaluation };
}

async function executeShotRender({ projectId, shotId, assetId, ownerUserId }) {
  const project = await getOwnedProject(projectId, ownerUserId);
  if (!project) throw new Error('Film project not found.');
  const shot = (project.shots || []).find(item => item.id === shotId);
  if (!shot) throw new Error('Shot not found.');
  const selectedTake = (project.takes || []).find(take => take.id === shot.selectedTakeId);
  const requestedAssetId = assetId || selectedTake?.assetId;
  const asset = requestedAssetId ? (project.assets || []).find(item => item.id === requestedAssetId) : null;
  if (!asset?.filename) throw new Error('Select a take with an imported media asset before rendering.');
  const inputPath = resolveMediaPath(asset.uri || asset.filename, { root, outputDir, assetDir });
  if (!inputPath || !fs.existsSync(inputPath)) throw new Error('Source media file is unavailable.');
  const rendered = await renderShot({ inputPath, outputDir, edit: shot.edit, effects: shot.effects, audioMix: shot.audioMix });
  const outputAsset = filmStore.addAsset(projectId, {
    name: 'Rendered Shot ' + shot.number, filename: rendered.filename, sourceType: 'rendered', uri: rendered.output,
    sceneId: shot.sceneId, shotId: shot.id, mimeType: 'video/mp4',
    notes: JSON.stringify({ sourceAssetId: asset.id, applied: rendered.applied, limitations: rendered.limitations })
  });
  const evaluation = await evaluateVideoFile(rendered.outputPath, { frameOutputRoot: path.join(dataDir, 'evaluation-frames') });
  await persistFilmProject(filmStore.getProject(projectId));
  return { asset: outputAsset, render: rendered, evaluation };
}

async function resolveQueuedTask(record) {
  const payload = record?.payload || {};
  if (record?.type === 'video-generation' || record?.type === 'media-generation') {
    return signal => executeCanonicalGeneration({ ...payload, signal });
  }
  if (record?.type === 'timeline-export') return signal => executeTimelineExport({ ...payload, signal });
  if (record?.type === 'shot-render') return signal => executeShotRender({ ...payload, signal });
  if (record?.type === 'production-execution') {
    return async signal => {
      const runner = createProductionRunner({
        outputDir,
        jobsFile,
        settings: readSettings,
        workflowPath: comfyWorkflowPath,
        executeTask: executeCanonicalGeneration,
        persistJob: saveJobToDatabase,
        readPersistedJobs: projectId => listJobsFromDatabase(payload.options?.ownerUserId || record.ownerUserId, 100, projectId)
      });
      return runner.execute(payload.graph || {}, { ...(payload.options || {}), signal });
    };
  }
  return null;
}

async function persistFilmProject(project) {
  if (!project) return project;
  if (!process.env.DATABASE_URL) return project;
  const persisted = await saveFilmProjectToDatabase(project);
  if (!persisted) throw new Error('PostgreSQL is configured but the film project could not be persisted.');
  return project;
}

app.get('/api/film/projects', async (req, res) => {
  const userId = getSessionUserId(req);
  const projects = process.env.DATABASE_URL
    ? await listFilmProjectsFromDatabase(userId)
    : filmStore.listProjects().filter(project => !project.ownerUserId || project.ownerUserId === userId);
  if (process.env.DATABASE_URL && projects.length) filmStore.replaceProjects(projects);
  res.json({ projects });
});

app.post('/api/film/projects', async (req, res) => {
  try { const project = filmStore.createProject({ ...(req.body || {}), ownerUserId: getSessionUserId(req) }); await persistFilmProject(project);
  res.status(201).json({ project }); }
  catch (error) { res.status(400).json({ error: error?.message || 'Could not create film project.' }); }
});



app.get('/api/film/projects/:projectId', async (req, res) => {
  const project = filmStore.getProject(req.params.projectId);
  if (!project || !getSessionUserId(req) || project.ownerUserId !== getSessionUserId(req)) return res.status(404).json({ error: 'Film project not found.' });
  res.json({ project });
});

app.patch('/api/film/projects/:projectId', async (req, res) => {
  const existing = filmStore.getProject(req.params.projectId);
  if (!existing || !getSessionUserId(req) || existing.ownerUserId !== getSessionUserId(req)) return res.status(404).json({ error: 'Film project not found.' });
  const project = filmStore.updateProject(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });

  await persistFilmProject(project);
  res.json({ project });
});

app.patch('/api/film/projects/:projectId/story', async (req, res) => {
  const project = filmStore.updateStory(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });

  await persistFilmProject(project);
  res.json({ project });
});

app.post('/api/film/projects/:projectId/characters', async (req, res) => {
  const project = filmStore.addCharacter(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });

  await persistFilmProject(project);
  res.status(201).json({ project });
});

app.patch('/api/film/projects/:projectId/characters/:characterId', async (req, res) => {
  const project = filmStore.updateCharacter(req.params.projectId, req.params.characterId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project or character not found.' });

  await persistFilmProject(project);
  res.json({ project });
});

app.patch('/api/film/projects/:projectId/world', async (req, res) => {
  const project = filmStore.updateWorld(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });

  await persistFilmProject(project);
  res.json({ project });
});

app.post('/api/film/projects/:projectId/scenes', async (req, res) => {
  const project = filmStore.addScene(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });

  await persistFilmProject(project);
  res.status(201).json({ project });
});

app.patch('/api/film/projects/:projectId/scenes/:sceneId', async (req, res) => {
  const project = filmStore.updateScene(req.params.projectId, req.params.sceneId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project or scene not found.' });

  await persistFilmProject(project);
  res.json({ project });
});

app.post('/api/film/projects/:projectId/shots', async (req, res) => {
  const project = filmStore.addShot(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });

  await persistFilmProject(project);
  res.status(201).json({ project });
});

app.patch('/api/film/projects/:projectId/shots/:shotId', async (req, res) => {
  const project = filmStore.updateShot(req.params.projectId, req.params.shotId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project or shot not found.' });

  await persistFilmProject(project);
  res.json({ project });
});

app.post('/api/film/projects/:projectId/scenes/:sceneId/reorder', async (req, res) => {
  const project = filmStore.reorderScene(req.params.projectId, req.params.sceneId, req.body?.sequence);
  if (!project) return res.status(404).json({ error: 'Film project or scene not found.' });

  await persistFilmProject(project);
  res.json({ project });
});

app.post('/api/film/projects/:projectId/shots/:shotId/reorder', async (req, res) => {
  const project = filmStore.reorderShot(req.params.projectId, req.params.shotId, req.body?.sequence);
  if (!project) return res.status(404).json({ error: 'Film project or shot not found.' });

  await persistFilmProject(project);
  res.json({ project });
});

app.post('/api/film/projects/:projectId/import-generation', async (req, res) => {
  try {
    const project = filmStore.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Film project not found.' });
    const generationId = String(req.body?.generationId || '');
    if (!generationId) return res.status(400).json({ error: 'generationId is required.' });
    const generation = await getGenerationFromDatabase(generationId, getSessionUserId(req));
    if (!generation) return res.status(404).json({ error: 'Generation record not found.' });
    const output = generation.output?.asset || generation.output?.uri || generation.output?.output || generation.output?.videoUrl || generation.output;
    if (!output) return res.status(409).json({ error: 'This generation has no media output to import.' });

    let shotId = req.body?.shotId || null;
    if (shotId && !(project.shots || []).some(shot => shot.id === shotId)) {
      return res.status(404).json({ error: 'Shot not found in this project.' });
    }
    if (!shotId) {
      const sceneId = req.body?.sceneId || project.scenes?.[0]?.id || filmStore.addScene(req.params.projectId, { title: 'Generated Scene' })?.scenes?.[0]?.id;
      const updated = filmStore.addShot(req.params.projectId, {
        sceneId,
        description: generation.prompt || 'Generated shot',
        duration: Number(generation.requirements?.duration || 0) || 0,
        framing: generation.requirements?.framing || 'medium shot',
        movement: generation.requirements?.cameraMovement || 'generated',
        lighting: generation.requirements?.lighting || 'cinematic'
      });
      shotId = updated?.shots?.at(-1)?.id || null;
    }
    if (!shotId) return res.status(500).json({ error: 'Could not create or resolve a project shot.' });

    const filename = path.basename(String(output).split('?')[0]);
    const asset = filmStore.addAsset(req.params.projectId, {
      id: 'asset-' + generation.id,
      name: 'Generated ' + generation.id,
      filename,
      sourceType: 'generated',
      uri: String(output),
      shotId,
      mimeType: 'video/mp4',
      notes: JSON.stringify({ generationId: generation.id, provider: generation.provider, model: generation.model })
    });
    const take = filmStore.addTake(req.params.projectId, {
      id: 'take-' + generation.id,
      shotId,
      assetId: asset?.id,
      mediaUri: String(output),
      notes: 'Imported AI generation ' + generation.id
    });
    if (take) filmStore.selectTake(req.params.projectId, shotId, take.id);
    res.status(201).json({ project: filmStore.getProject(req.params.projectId), shotId, asset, take });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Could not import generation into film project.' });
  }
});

app.post('/api/film/projects/:projectId/takes', async (req, res) => {
  const take = filmStore.addTake(req.params.projectId, req.body || {});
  if (!take) return res.status(404).json({ error: 'Film project not found.' });
  await persistFilmProject(filmStore.getProject(req.params.projectId));
  res.status(201).json({ take });
});

app.post('/api/film/projects/:projectId/shots/:shotId/select-take', async (req, res) => {
  const project = filmStore.selectTake(req.params.projectId, req.params.shotId, req.body?.takeId);
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  await persistFilmProject(project);
  res.json({ project });
});

app.post('/api/film/projects/:projectId/assets/upload', (req, res, next) => upload.single('file')(req, res, err => {
  if (err) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
    return res.status(400).json({ error: err.message || 'Invalid upload.' });
  }
  next();
}), async (req, res) => {
  let stored = null;
  try {
    const project = filmStore.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Film project not found.' });
    if (!req.file) return res.status(400).json({ error: 'A media file is required.' });
    await validateUploadedVideo(req.file.path);
    stored = await assetStore.saveUploadedFile(req.file);
    const asset = filmStore.addAsset(req.params.projectId, {
      ...stored,
      sceneId: req.body?.sceneId || null,
      shotId: req.body?.shotId || null,
      notes: req.body?.notes || ''
    });
    if (!asset) throw new Error('Could not persist the uploaded media asset.');
    res.status(201).json({ asset });
  } catch (error) {
    if (stored?.filename) { try { fs.unlinkSync(path.join(assetDir, stored.filename)); } catch {} }
    res.status(400).json({ error: error?.message || 'Could not ingest media asset.' });
  } finally {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch {} }
  }
});

app.patch('/api/film/projects/:projectId/assets/:assetId', async (req, res) => {
  const asset = filmStore.updateAsset(req.params.projectId, req.params.assetId, req.body || {});
  if (!asset) return res.status(404).json({ error: 'Film project or asset not found.' });
  await persistFilmProject(filmStore.getProject(req.params.projectId));
  res.json({ asset });
});

app.post('/api/film/projects/:projectId/assets/:assetId/attach-shot', async (req, res) => {
  const project = filmStore.attachAssetToShot(req.params.projectId, req.params.assetId, req.body?.shotId);
  if (!project) return res.status(404).json({ error: 'Film project, asset or shot not found.' });
  await persistFilmProject(project);
  res.json({ project });
});

app.post('/api/film/projects/:projectId/assets/:assetId/attach-take', async (req, res) => {
  const project = filmStore.attachAssetToTake(req.params.projectId, req.params.assetId, req.body?.takeId);
  if (!project) return res.status(404).json({ error: 'Film project, asset or take not found.' });
  await persistFilmProject(project);
  res.json({ project });
});

app.get('/api/film/projects/:projectId/assets', (req, res) => {
  const project = filmStore.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.json({ assets: project.assets || [] });
});

app.post('/api/film/projects/:projectId/assets', async (req, res) => {
  const asset = filmStore.addAsset(req.params.projectId, req.body || {});
  if (!asset) return res.status(404).json({ error: 'Film project not found.' });
  res.status(201).json({ asset });
});

app.post('/api/film/projects/:projectId/export', async (req, res) => {
  try {
    const ownerUserId = getSessionUserId(req);
    const project = await getOwnedProject(req.params.projectId, ownerUserId);
    if (!project) return res.status(404).json({ error: 'Film project not found.' });
    const job = generationQueue.enqueue('timeline-export', signal => executeTimelineExport({ projectId: project.id, ownerUserId, signal }), {
      ownerUserId,
      payload: { projectId: project.id, ownerUserId }
    });
    res.status(202).json({ status: 'Queued', job });
  } catch (error) {
    res.status(error?.statusCode || 400).json({ error: error?.message || 'Could not queue film export.' });
  }
});

app.post('/api/film/projects/:projectId/shots/:shotId/render', async (req, res) => {
  try {
    const project = filmStore.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Film project not found.' });
    const shot = (project.shots || []).find(item => item.id === req.params.shotId);
    if (!shot) return res.status(404).json({ error: 'Shot not found.' });

    const selectedTake = (project.takes || []).find(take => take.id === shot.selectedTakeId);
    const requestedAssetId = req.body?.assetId || selectedTake?.assetId;
    const asset = requestedAssetId ? (project.assets || []).find(item => item.id === requestedAssetId) : null;
    if (!asset?.filename) return res.status(400).json({ error: 'Select a take with an imported media asset before rendering.' });

    const inputPath = resolveMediaPath(asset.uri || asset.filename, { root, outputDir, assetDir });
    if (!inputPath || !fs.existsSync(inputPath)) return res.status(404).json({ error: 'Source media file is unavailable.' });

    const rendered = await renderShot({ inputPath, outputDir, edit: shot.edit, effects: shot.effects, audioMix: shot.audioMix });
    const outputAsset = filmStore.addAsset(req.params.projectId, {
      name: 'Rendered Shot ' + shot.number, filename: rendered.filename, sourceType: 'rendered', uri: rendered.output,
      sceneId: shot.sceneId, shotId: shot.id, mimeType: 'video/mp4',
      notes: JSON.stringify({ sourceAssetId: asset.id, applied: rendered.applied, limitations: rendered.limitations })
    });
    const evaluation = await evaluateVideoFile(rendered.outputPath, { frameOutputRoot: path.join(dataDir, 'evaluation-frames') });
    res.status(201).json({ asset: outputAsset, render: rendered, evaluation });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Could not render shot.' });
  }
});

app.post('/api/film/projects/:projectId/shots/:shotId/render', async (req, res) => {
  try {
    const ownerUserId = getSessionUserId(req);
    const project = await getOwnedProject(req.params.projectId, ownerUserId);
    if (!project) return res.status(404).json({ error: 'Film project not found.' });
    if (!(project.shots || []).some(shot => shot.id === req.params.shotId)) return res.status(404).json({ error: 'Shot not found.' });
    const job = generationQueue.enqueue('shot-render', signal => executeShotRender({
      projectId: project.id, shotId: req.params.shotId, assetId: req.body?.assetId || null, ownerUserId, signal
    }), {
      ownerUserId,
      payload: { projectId: project.id, shotId: req.params.shotId, assetId: req.body?.assetId || null, ownerUserId }
    });
    res.status(202).json({ status: 'Queued', job });
  } catch (error) {
    res.status(error?.statusCode || 400).json({ error: error?.message || 'Could not queue shot render.' });
  }
});

app.post('/api/film/projects/:projectId/continuity', async (req, res) => {
  const event = filmStore.addContinuityEvent(req.params.projectId, req.body || {});
  if (!event) return res.status(404).json({ error: 'Film project not found.' });
  await persistFilmProject(filmStore.getProject(req.params.projectId));
  res.status(201).json({ event });
});

function databaseAvailableForContinuity() { return Boolean(process.env.DATABASE_URL); }

app.post('/api/film/projects/:projectId/assistant', async (req, res) => {
  const project = filmStore.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Film project not found.' });

  const mode = String(req.body?.mode || 'review');
  const shots = project.shots || [];
  const takes = project.takes || [];
  const advice = [];
  const gaps = [];

  if (mode === 'coverage') {
    const framings = new Set(shots.map(s => String(s.framing || '').toLowerCase()));
    if (!shots.length) advice.push('No shots exist yet. Build an establishing shot, action coverage and a reaction/detail shot.');
    if (![...framings].some(x => x.includes('wide'))) gaps.push('establishing/wide');
    if (![...framings].some(x => x.includes('medium') || x.includes('full'))) gaps.push('medium/action');
    if (![...framings].some(x => x.includes('close'))) gaps.push('close-up/reaction');
    if (gaps.length) advice.push('Missing coverage: ' + gaps.join(', ') + '.');
    else advice.push('Basic framing coverage exists. Review shot order and whether each beat has a motivated cut.');
  } else if (mode === 'continuity') {
    const characterCount = project.characters?.length || 0;
    const worldRules = project.world?.rules?.length || 0;
    const continuityEvents = project.continuity?.length || 0;
    if (!characterCount) advice.push('No character continuity records exist yet. Add characters and their appearance/state references.');
    if (!worldRules) advice.push('No world rules are recorded. Add rules that must remain invariant between shots.');
    if (!continuityEvents) advice.push('No continuity events are logged. Record state changes for wardrobe, props, position, injuries and other persistent details.');
    for (const shot of shots) {
      if (!shot.sceneId) advice.push('Shot ' + shot.number + ' is not attached to a scene.');
      if (!shot.lens) advice.push('Shot ' + shot.number + ' has no lens record, which weakens camera continuity.');
    }

    try {
      const entityRows = await getEntityState(project.id);
      if (Array.isArray(entityRows) && entityRows.length) {
        const unresolved = entityRows.filter(entity => {
          const state = entity.state || {};
          return !state.appearance && !state.position && !state.wardrobe && !state.props && !entity.continuity;
        });
        if (unresolved.length) advice.push(unresolved.length + ' tracked entity state(s) need explicit continuity attributes before the next shot.');
      } else if (databaseAvailableForContinuity(project.id)) {
        advice.push('The project has no persisted entity continuity records yet. Register characters, props and other persistent entities before relying on state resolution.');
      }
    } catch (error) {
      console.warn('Continuity entity lookup failed:', error?.message || error);
      advice.push('Entity continuity storage could not be checked; verify database connectivity before approving the next shot.');
    }

    if (!advice.length) advice.push('Continuity records are present. Review resolved entity states against the latest shot before generating the next take.');
  } else if (mode === 'next-step') {
    const pendingShots = shots.filter(s => s.status !== 'completed' && !s.selectedTakeId);
    const unreviewedTakes = takes.filter(t => !t.selected);
    if (!project.scenes?.length) advice.push('Create the first scene.');
    else if (!shots.length) advice.push('Build the first shot plan.');
    else if (pendingShots.length) advice.push('Generate or record takes for the next unapproved shot: Shot ' + pendingShots[0].number + '.');
    else if (unreviewedTakes.length) advice.push('Review and select the strongest remaining take.');
    else advice.push('Assemble the selected takes into the timeline and export a review cut.');
  } else {
    if (!project.scenes?.length) advice.push('Create scenes before building the final shot schedule.');
    if (!shots.length) advice.push('Create the first coverage plan.');
    const withoutTake = shots.filter(s => !takes.some(t => t.shotId === s.id)).length;
    if (withoutTake) advice.push(withoutTake + ' planned shot(s) have no logged take yet.');
    if (!advice.length) advice.push('No obvious planning gaps. Select approved takes and move to the timeline/export stage.');
  }

  res.json({
    mode,
    project_id: project.id,
    summary: { scenes: project.scenes?.length || 0, shots: shots.length, takes: takes.length, assets: project.assets?.length || 0 },
    recommendations: advice,
    coverage_gaps: gaps,
    next_action: advice[0] || 'Review the current production state.'
  });
});


app.get('/api/projects/:projectId/entities', async (req, res) => {
  try {
    const database = await getDatabaseStatus();
    if (!database.enabled) return res.status(503).json({ error: 'Entity storage is unavailable because the database is not configured.', database });
    if (!database.connected) return res.status(503).json({ error: 'Entity storage is unavailable because the database is not connected.', database });
    const entities = await getEntityState(req.params.projectId, req.query.entityId || null);
    res.json({ entities });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Could not resolve entities.' });
  }
});

app.get('/api/projects/:projectId/entities/:entityId/state', async (req, res) => {
  try {
    const state = await resolveEntityStateAt(
      req.params.projectId,
      req.params.entityId,
      req.query.sceneId || null,
      req.query.shotId || null
    );
    if (!state) {
      const database = await getDatabaseStatus();
      if (!database.enabled) return res.status(503).json({ error: 'Entity state is unavailable because the database is not configured.', database });
      if (!database.connected) return res.status(503).json({ error: 'Entity state is unavailable because the database is not connected.', database });
      return res.status(404).json({ error: 'Entity not found.' });
    }
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Could not resolve entity state.' });
  }
});

app.post('/api/projects/:projectId/entities', async (req, res) => {
  try {
    const database = await getDatabaseStatus();
    if (!database.enabled) return res.status(503).json({ error: 'Entity storage is unavailable because the database is not configured.', database });
    if (!database.connected) return res.status(503).json({ error: 'Entity storage is unavailable because the database is not connected.', database });
    const entities = Array.isArray(req.body?.entities) ? req.body.entities : [];
    await upsertWorldEntities(req.params.projectId, entities);
    res.json({ ok: true, count: entities.length });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Could not save world entities.' });
  }
});

app.post('/api/projects/:projectId/entity-events', requireProjectAccess, async (req, res) => {
  try {
    const database = await getDatabaseStatus();
    if (!database.enabled) return res.status(503).json({ error: 'Entity event storage is unavailable because the database is not configured.', database });
    if (!database.connected) return res.status(503).json({ error: 'Entity event storage is unavailable because the database is not connected.', database });
    await recordEntityEvent({
      projectId: req.params.projectId,
      ownerUserId: req.authUserId,
      sceneId: req.body?.sceneId,
      shotId: req.body?.shotId,
      entityId: req.body?.entityId,
      eventType: req.body?.eventType,
      changes: req.body?.changes || {}
    });
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Could not save entity event.' });
  }
});

app.get('/api/knowledge/task', (req, res) => {
  try {
    const task = {
      domain: req.query.domain || '',
      operation: req.query.operation || '',
      purpose: req.query.purpose || '',
      prompt: req.query.prompt || '',
      requirements: {}
    };
    res.json({ knowledge: getKnowledgeForTask(task, { limit: Number(req.query.limit || 8) }) });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Could not retrieve task knowledge.' });
  }
});

app.post('/api/knowledge/validate', (req, res) => {
  res.json({ references: validateKnowledgeReferences(req.body?.knowledge_ids || req.body?.knowledgeRefs || []) });
});

app.get('/api/media-formats', (req, res) => {
  const format = req.query.id ? getMediaFormat(String(req.query.id)) : null;
  if (req.query.id && !format) return res.status(404).json({ error: 'Media format not found.' });
  res.json(format ? { format } : { formats: listMediaFormats() });
});

app.post('/api/story/plan', (req, res) => {
  try { res.json(buildStoryPlan(req.body || {})); }
  catch (error) { res.status(400).json({ error: error?.message || 'Could not build story plan.' }); }
});

app.post('/api/media/plan', (req, res) => {
  try { res.json(buildMediaPlan(req.body || {})); }
  catch (error) { res.status(400).json({ error: error?.message || 'Could not build media plan.' }); }
});

app.post('/api/film/assist', (req, res) => {
  try {
    const input = req.body || {};
    const story = String(input.story || input.prompt || '').trim();
    if (!story) return res.status(400).json({ error: 'Describe the film, scene, or idea you want help with.' });
    const storyPlan = buildStoryPlan({
      title: input.title || 'Untitled Film',
      story,
      genre: input.genre || 'drama',
      characters: input.characters || [],
      locations: input.locations || [],
      props: input.props || []
    });
    const formatPlan = buildFormatProductionPlan({
      format: 'cinematic',
      genre: input.genre || 'drama',
      prompt: story,
      title: input.title || 'Untitled Film',
      storyPlan,
      aspectRatio: input.aspectRatio || '16:9',
      quality: input.quality || 'cinematic'
    });
    res.json({
      assistant: {
        mode: 'normal-film-production',
        message: 'I turned the idea into a film-production starting plan. You remain the director; the agent organizes the work and explains the next practical step.',
        next_step: 'Review the scenes and shot plan before generating anything.'
      },
      story_plan: storyPlan,
      production_plan: formatPlan,
      director_checklist: [
        'Confirm the story and scene order.',
        'Review characters, locations, props and continuity.',
        'Review each shot framing, camera movement and lighting.',
        'Choose whether each shot should be filmed normally, generated with AI, or imported from existing footage.',
        'Record takes and notes, then assemble the approved material.'
      ]
    });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Film assistant could not build the plan.' });
  }
});

app.post('/api/media/format-plan', (req, res) => {
  try { res.json(buildFormatProductionPlan(req.body || {})); }
  catch (error) { res.status(400).json({ error: error?.message || 'Could not build format production plan.' }); }
});

app.post('/api/media/execution-plan', (req, res) => {
  try {
    const graph = req.body?.productionGraph || req.body?.production_graph || req.body;
    res.json(prepareExecutionPlan(graph || {}));
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Could not prepare execution plan.' });
  }
});

app.post('/api/production/execute', generationRateLimit, async (req, res) => {
  try {
    const graph = validateProductionGraphInput(req.body || {});
    const ownerUserId = getSessionUserId(req);
    const project = await getOwnedProject(graph.project_id, ownerUserId);
    if (!project) return res.status(404).json({ error: 'Film project not found.' });
    for (const node of graph.nodes || []) {
      if (node.shot_id && !(project.shots || []).some(shot => shot.id === node.shot_id)) return res.status(404).json({ error: 'Production graph references a shot outside this project.' });
    }
    if (!ownerUserId) return res.status(401).json({ error: 'A user session is required for production execution.' });
    const payload = {
      graph,
      options: {
        allowPaid: paidGenerationAllowed,
        preferLocal: req.body?.preferLocal !== false,
        providerId: req.body?.providerId || '',
        ownerUserId
      }
    };
    const job = generationQueue.enqueue('production-execution', async signal => {
      const runner = createProductionRunner({
        outputDir,
        jobsFile,
        settings: readSettings,
        workflowPath: comfyWorkflowPath,
        executeTask: executeCanonicalGeneration,
        persistJob: saveJobToDatabase,
        readPersistedJobs: projectId => listJobsFromDatabase(payload.options.ownerUserId, 100, projectId)
      });
      return runner.execute(payload.graph, { ...payload.options, signal });
    }, { ownerUserId, payload });
    res.status(202).json({ status: 'Queued', job });
  } catch (error) {
    const status = error?.statusCode || 500;
    res.status(status).json({ error: error?.message || 'Could not queue production execution.' });
  }
});

app.get('/api/production/jobs/:projectId', async (req, res) => {
  const project = await getOwnedProject(req.params.projectId, getSessionUserId(req));
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  const runner = createProductionRunner({
    jobsFile,
    executeTask: executeCanonicalGeneration,
    persistJob: saveJobToDatabase,
    readPersistedJobs: projectId => listJobsFromDatabase(getSessionUserId(req), 100, projectId)
  });
  res.json({ jobs: await runner.readJobs(req.params.projectId) });
});

app.get('/api/knowledge', (req, res) => {
  res.json({ domains: listKnowledgeDomains(), results: searchKnowledge(req.query.q || '', req.query.domain || '') });
});

app.get('/api/knowledge/:id', (req, res) => {
  const entry = getKnowledgeEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Knowledge entry not found.' });
  res.json({ entry });
});

app.get('/api/workers', async (req, res) => {
  const settings = readSettings();
  const safeComfyUrl = await assertSafeComfyUrl(settings.comfyUrl);
      const worker = await createComfyWorker({ baseUrl: safeComfyUrl, workflowPath: comfyWorkflowPath, outputDir });
  res.json({ workers: [{ id: worker.id, runtime: worker.runtime, configured: worker.configured, health: worker.health, workflowPathConfigured: Boolean(comfyWorkflowPath) }] });
});

app.post('/api/media/generate', generationRateLimit, async (req, res) => {
  try {
    const input = validateMediaGenerateInput(req.body || {});
    const task = normalizeMediaTask(input);
    task.sound = normalizeSoundPlan(req.body?.sound || {});
    validateMediaTask(task);
    const ownerUserId = getSessionUserId(req);
    if (!ownerUserId) return res.status(401).json({ error: 'A user session is required for generation.' });
    const payload = { ...input, operation: task.operation, requirements: task.requirements, metadata: task.metadata, allowPaid: paidGenerationAllowed, ownerUserId };
    const job = generationQueue.enqueue('media-generation', signal => executeCanonicalGeneration({ ...payload, signal }), { ownerUserId: getSessionUserId(req), payload });
    res.status(202).json({ status: 'Queued', job });
  } catch (error) {
    res.status(error?.statusCode || 400).json({ error: error?.message || 'Could not queue media generation.' });
  }
});

app.get('/api/providers', async (req, res) => {
  const settings = readSettings();
  const providers = listProviders(settings);
  let comfy = { ok: false, error: 'ComfyUI endpoint unavailable.' };
        try { comfy = await getComfyHealth(await assertSafeComfyUrl(settings.comfyUrl)); } catch (error) { comfy = { ok: false, error: error.message }; }
  const enriched = providers.map(provider =>
    provider.id === 'comfyui'
      ? { ...provider, configured: comfy.ok, health: comfy }
      : { ...provider, health: provider.configured ? { ok: true } : { ok: false, detail: 'Not configured.' } }
  );
  const task = String(req.query.task || 'text-to-video');
  const allowPaid = paidGenerationAllowed;
  const preferFree = req.query.preferFree === 'true';
  const preferLocal = req.query.preferLocal === 'true';
  const providerId = req.query.providerId ? String(req.query.providerId) : '';
  const decision = chooseProvider(enriched, { task, allowPaid, preferFree, preferLocal, providerId });
  res.json({
    providers: enriched,
    routing: {
      task,
      selected: decision.selected?.id || null,
      ranked: decision.ranked.map(item => ({ id: item.candidate.id, score: item.score }))
    }
  });
});

app.get('/api/database', async (req, res) => { res.json(await getDatabaseStatus()); });

app.get('/api/settings', (req, res) => {
  const s = readSettings();
  res.json({
    hfSpace: s.hfSpace,
    hasHFToken: Boolean(s.hfToken),
    hasLumaApiKey: Boolean(s.lumaApiKey),
    lumaModel: s.lumaModel,
    comfyConfigured: Boolean(process.env.COMFYUI_URL),
    comfyModelProfile: s.comfyModelProfile,
    secretsEditable: false
  });
});

app.post('/api/settings', (req, res) => {
  res.status(410).json({ error: 'Provider secrets are server-managed. Set HF_TOKEN, LUMAAI_API_KEY and COMFYUI_URL in the deployment environment.' });
});

app.get('/api/generations', async (req, res) => {
  try { res.json({ records: await listGenerationsFromDatabase(req.query.limit, getSessionUserId(req)) }); } catch (error) { res.status(503).json({ error: error?.message || 'Generation history is unavailable.' }); }
});


app.post('/api/generate', generationRateLimit, async (req, res) => {
  try {
    const input = validateGenerateInput(req.body || {});
    const ownerUserId = getSessionUserId(req);
    if (!ownerUserId) return res.status(401).json({ error: 'A user session is required for generation.' });
    const project = input.projectId ? await getOwnedProject(String(input.projectId), ownerUserId) : null;
    if (input.projectId && !project) return res.status(404).json({ error: 'Film project not found.' });
    if (input.shotId && (!project || !(project.shots || []).some(shot => shot.id === input.shotId))) return res.status(404).json({ error: 'Shot not found in this project.' });
    const payload = { ...input, allowPaid: paidGenerationAllowed, ownerUserId };
    const job = generationQueue.enqueue('video-generation', signal => executeCanonicalGeneration({ ...payload, signal }), { ownerUserId: getSessionUserId(req), payload });
    res.status(202).json({ status: 'Queued', job });
  } catch (error) {
    res.status(error?.statusCode || 400).json({ error: error?.message || 'Could not queue video generation.' });
  }
});

const clientDist = path.join(root, 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/|\/output\/).*/, (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/output/')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

try { assertAuthConfigured(); } catch (error) { console.error(error.message); if (process.env.NODE_ENV === 'production') process.exit(1); }

initDatabase().then(async () => {
  try {
    const persistedProjects = await listFilmProjectsFromDatabase();
    if (persistedProjects.length) {
      // PostgreSQL is the canonical project store; local JSON is only a local runtime cache.
      filmStore.replaceProjects(persistedProjects);
    }

    if (process.env.DATABASE_URL) {
      const queuedJobs = await recoverableJobsFromDatabase(null, 100);
      await generationQueue.recover(queuedJobs, resolveQueuedTask);
      if (queuedJobs.length) console.log(`Recovered ${queuedJobs.length} queued generation job(s) from PostgreSQL.`);
    }
  } catch (error) {
    console.error('Durable state recovery skipped:', error?.message || error);
  }
  app.listen(port, '0.0.0.0', () => console.log(`Cinematic Agent listening on port ${port}`));
}).catch(error => {
  console.error('Database initialization failed:', error?.message || error);
  if (process.env.NODE_ENV === 'production') process.exit(1);
  app.listen(port, '0.0.0.0', () => console.log(`Cinematic Agent listening on port ${port} (database unavailable)`));
});
