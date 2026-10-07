import pg from 'pg';
import crypto from 'node:crypto';

const { Pool } = pg;
let pool = null;

function dbOwnerId(value) { return value && value !== 'admin' ? String(value) : null; }

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    const ca = process.env.DATABASE_SSL_CA || undefined;
    const ssl = process.env.DATABASE_SSL === 'false'
      ? false
      : { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl,
      connectionTimeoutMillis: 5000,
      query_timeout: 15000,
      statement_timeout: 15000,
      application_name: 'cinematic-agent'
    });
  }
  return pool;
}

export async function initDatabase() {
  const db = getPool();
  if (!db) return { enabled: false };

  await db.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      sessions_revoked_at TIMESTAMPTZ,
      mfa_secret TEXT,
      mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS media_projects (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT REFERENCES app_users(id),
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS media_entities (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      name TEXT NOT NULL,
      state JSONB NOT NULL DEFAULT '{}'::jsonb,
      continuity JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, entity_type, name)
    );

    CREATE INDEX IF NOT EXISTS idx_media_entities_project ON media_entities(project_id);
    CREATE INDEX IF NOT EXISTS idx_media_entities_type ON media_entities(entity_type);

    CREATE TABLE IF NOT EXISTS media_entity_events (
      id BIGSERIAL PRIMARY KEY,
      project_id TEXT NOT NULL,
      scene_id TEXT,
      shot_id TEXT,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      changes JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_media_entity_events_entity ON media_entity_events(entity_id);

    CREATE TABLE IF NOT EXISTS media_generations (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT REFERENCES app_users(id),
      project_id TEXT,
      scene_id TEXT,
      shot_id TEXT,
      domain TEXT NOT NULL,
      operation TEXT NOT NULL,
      provider TEXT,
      worker_id TEXT,
      model TEXT,
      workflow TEXT,
      prompt TEXT,
      requirements JSONB NOT NULL DEFAULT '{}'::jsonb,
      sound_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
      output JSONB NOT NULL DEFAULT '{}'::jsonb,
      execution JSONB NOT NULL DEFAULT '{}'::jsonb,
      evaluation JSONB NOT NULL DEFAULT '{}'::jsonb,
      licensing JSONB NOT NULL DEFAULT '{}'::jsonb,
      dataset_id TEXT,
      estimated_cost_usd NUMERIC,
      actual_cost_usd NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_media_generations_project ON media_generations(project_id);
    CREATE INDEX IF NOT EXISTS idx_media_generations_shot ON media_generations(shot_id);
    CREATE INDEX IF NOT EXISTS idx_media_generations_created ON media_generations(created_at DESC);
    ALTER TABLE media_projects ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES app_users(id);
    ALTER TABLE media_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE media_generations ADD COLUMN IF NOT EXISTS owner_user_id TEXT REFERENCES app_users(id);
    ALTER TABLE media_generations ADD COLUMN IF NOT EXISTS dataset_id TEXT;
    ALTER TABLE media_generations ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC;
    ALTER TABLE media_generations ADD COLUMN IF NOT EXISTS actual_cost_usd NUMERIC;

    CREATE TABLE IF NOT EXISTS media_jobs (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT REFERENCES app_users(id),
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      attempts INTEGER NOT NULL DEFAULT 1,
      retry_of TEXT,
      result JSONB,
      error TEXT,
      payload JSONB,
      worker_id TEXT,
      lease_until TIMESTAMPTZ
    );

    ALTER TABLE media_jobs ADD COLUMN IF NOT EXISTS payload JSONB;
    ALTER TABLE media_jobs ADD COLUMN IF NOT EXISTS worker_id TEXT;
    ALTER TABLE media_jobs ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_media_jobs_owner ON media_jobs(owner_user_id);
    CREATE INDEX IF NOT EXISTS idx_media_jobs_created ON media_jobs(created_at DESC);

    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      bucket_key TEXT PRIMARY KEY,
      window_started_at TIMESTAMPTZ NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS media_knowledge_refs (
      generation_id TEXT NOT NULL,
      knowledge_id TEXT NOT NULL,
      PRIMARY KEY (generation_id, knowledge_id)
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMPTZ;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
    ALTER TABLE app_users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  return { enabled: true };
}

export async function saveGenerationToDatabase(record) {
  const db = getPool();
  if (!db) return false;
  const task = record.task || {};
  const execution = record.execution || {
    provider: record.provider || null,
    worker_id: record.workerId || null,
    model: record.model || null,
    workflow: record.workflow || null
  };
  const creativeInput = record.creative_input || {
    prompt: record.prompt || '',
    requirements: record.requirements || {}
  };
  const output = record.output || {};
  const evaluation = record.evaluation || record.qualityControl || {};
  const id = record.id || record.dataset_id;
  if (!id) throw new Error('A generation record requires an id.');
  if (dbOwnerId(record.ownerUserId) === null) throw new Error('A persisted generation requires an authenticated owner.');

  await db.query(
    `INSERT INTO media_generations
      (id, owner_user_id, project_id, scene_id, shot_id, domain, operation, provider, worker_id, model, workflow, prompt, requirements, sound_plan, output, execution, evaluation, licensing, dataset_id, estimated_cost_usd, actual_cost_usd)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
     ON CONFLICT (id) DO UPDATE SET
       output=EXCLUDED.output,
       execution=EXCLUDED.execution,
       evaluation=EXCLUDED.evaluation,
       dataset_id=COALESCE(EXCLUDED.dataset_id, media_generations.dataset_id),
       estimated_cost_usd=COALESCE(EXCLUDED.estimated_cost_usd, media_generations.estimated_cost_usd),
       actual_cost_usd=COALESCE(EXCLUDED.actual_cost_usd, media_generations.actual_cost_usd)`,
    [
      id, dbOwnerId(record.ownerUserId), record.project || record.projectId || null, record.scene || record.sceneId || null, record.shot || record.shotId || null,
      task.domain || record.domain || 'video', task.operation || record.operation || 'text-to-video',
      execution.provider || record.provider || null, execution.worker_id || record.workerId || null,
      execution.model || record.model || null, execution.workflow || record.workflow || null,
      creativeInput.prompt || record.prompt || '', JSON.stringify(creativeInput.requirements || record.requirements || {}),
      JSON.stringify(record.production?.sound || record.soundPlan || {}), JSON.stringify(output),
      JSON.stringify(execution), JSON.stringify(evaluation), JSON.stringify(record.licensing || {}),
      record.dataset_id || null,
      record.execution?.estimated_cost_usd ?? record.estimated_cost_usd ?? null,
      record.execution?.actual_cost_usd ?? record.actual_cost_usd ?? null
    ]
  );

  for (const id of record.knowledge_refs || []) {
    await db.query(
      `INSERT INTO media_knowledge_refs (generation_id, knowledge_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [record.id || record.dataset_id, id]
    );
  }

  return true;
}

export async function getDatabaseStatus() {
  const db = getPool();
  if (!db) return { enabled: false };
  try {
    await db.query('SELECT 1');
    return { enabled: true, connected: true };
  } catch (error) {
    return { enabled: true, connected: false, detail: error?.message || 'Database connection failed.' };
  }
}


export async function upsertWorldEntities(projectId, entities = []) {
  const db = getPool();
  if (!db || !projectId) return false;

  for (const entity of entities) {
    if (!entity?.name || !entity?.type) continue;
    await db.query(
      `INSERT INTO media_entities (id, project_id, entity_type, name, state, continuity)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (project_id, entity_type, name) DO UPDATE SET
         state=media_entities.state || EXCLUDED.state,
         continuity=media_entities.continuity || EXCLUDED.continuity,
         updated_at=NOW()`,
      [
        entity.id || `${projectId}-${entity.type}-${entity.name}`.toLowerCase().replace(/[^a-z0-9_-]+/g, '-'),
        projectId,
        entity.type,
        entity.name,
        JSON.stringify(entity.state || {}),
        JSON.stringify(entity.continuity || {})
      ]
    );
  }
  return true;
}

export async function recordEntityEvent(event = {}) {
  const db = getPool();
  if (!db || !event.entityId || !event.projectId || !event.eventType) return false;
  await db.query(
    `INSERT INTO media_entity_events
      (project_id, scene_id, shot_id, entity_id, event_type, changes)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      event.projectId,
      event.sceneId || null,
      event.shotId || null,
      event.entityId,
      event.eventType,
      JSON.stringify(event.changes || {})
    ]
  );
  return true;
}

export async function getEntityState(projectId, entityId = null) {
  const db = getPool();
  if (!db || !projectId) return null;
  const query = entityId
    ? ['SELECT * FROM media_entities WHERE project_id=$1 AND id=$2', [projectId, entityId]]
    : ['SELECT * FROM media_entities WHERE project_id=$1 ORDER BY entity_type, name', [projectId]];
  const result = await db.query(query[0], query[1]);
  return entityId ? (result.rows[0] || null) : result.rows;
}

export async function resolveEntityStateAt(projectId, entityId, sceneId = null, shotId = null) {
  const db = getPool();
  if (!db || !projectId || !entityId) return null;

  const entity = await db.query(
    'SELECT * FROM media_entities WHERE project_id=$1 AND id=$2',
    [projectId, entityId]
  );
  if (!entity.rows[0]) return null;

  const events = await db.query(
    `SELECT scene_id, shot_id, event_type, changes, created_at
     FROM media_entity_events
     WHERE project_id=$1 AND entity_id=$2
     ORDER BY created_at ASC`,
    [projectId, entityId]
  );

  const naturalKey = (value) => String(value || '').split(/(\d+)/).map(part => /^\d+$/.test(part) ? Number(part) : part.toLowerCase());
  const compareNatural = (a, b) => {
    const aa = naturalKey(a);
    const bb = naturalKey(b);
    for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
      if (aa[i] === undefined) return -1;
      if (bb[i] === undefined) return 1;
      if (typeof aa[i] === 'number' && typeof bb[i] === 'number') {
        if (aa[i] !== bb[i]) return aa[i] - bb[i];
      } else if (String(aa[i]) !== String(bb[i])) {
        return String(aa[i]).localeCompare(String(bb[i]));
      }
    }
    return 0;
  };
  const targetScene = sceneId ? String(sceneId) : null;
  const targetShot = shotId ? String(shotId) : null;
  const orderedEvents = [...events.rows].sort((a, b) => {
    const sceneCompare = compareNatural(a.scene_id || '', b.scene_id || '');
    if (sceneCompare !== 0) return sceneCompare;
    const shotCompare = compareNatural(a.shot_id || '', b.shot_id || '');
    if (shotCompare !== 0) return shotCompare;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  const state = { ...(entity.rows[0].state || {}) };
  const history = [];
  for (const event of orderedEvents) {
    if (targetScene && event.scene_id && compareNatural(event.scene_id, targetScene) > 0) break;
    if (targetShot && event.scene_id === targetScene && event.shot_id && compareNatural(event.shot_id, targetShot) > 0) break;
    Object.assign(state, event.changes || {});
    history.push(event);
  }

  return {
    entity: entity.rows[0],
    state,
    history,
    resolved_at: { scene_id: sceneId, shot_id: shotId }
  };
}

export async function saveFilmProjectToDatabase(project) {
  const db = getPool();
  if (!db || !project?.id) return false;
  if (dbOwnerId(project.ownerUserId) === null) throw new Error('A persisted film project requires an authenticated owner.');
  await db.query(
    `INSERT INTO media_projects (id, owner_user_id, name, metadata, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (id) DO UPDATE SET owner_user_id=COALESCE(EXCLUDED.owner_user_id, media_projects.owner_user_id), name=EXCLUDED.name, metadata=EXCLUDED.metadata, updated_at=NOW()`,
    [project.id, dbOwnerId(project.ownerUserId), project.title || 'Untitled Film', JSON.stringify(project)]
  );
  return true;
}

export async function getFilmProjectFromDatabase(projectId, ownerUserId = null) {
  const db = getPool();
  if (!db || !projectId) return null;
  const result = ownerUserId
    ? await db.query(
        'SELECT metadata FROM media_projects WHERE id=$1 AND owner_user_id=$2 LIMIT 1',
        [projectId, ownerUserId]
      )
    : await db.query('SELECT metadata FROM media_projects WHERE id=$1 LIMIT 1', [projectId]);
  return result.rows[0]?.metadata || null;
}

export async function listFilmProjectsFromDatabase(ownerUserId = null) {
  const db = getPool();
  if (!db) return [];
  const result = ownerUserId
    ? await db.query('SELECT metadata FROM media_projects WHERE owner_user_id=$1 ORDER BY updated_at DESC, created_at DESC', [ownerUserId])
    : await db.query('SELECT metadata FROM media_projects ORDER BY updated_at DESC, created_at DESC');
  return result.rows.map(row => row.metadata).filter(project => project && project.id);
}


export async function getGenerationFromDatabase(id, ownerUserId = null) {
  const db = getPool();
  if (!db || !id) return null;
  const result = ownerUserId
    ? await db.query('SELECT * FROM media_generations WHERE id=$1 AND owner_user_id=$2 LIMIT 1', [id, ownerUserId])
    : await db.query('SELECT * FROM media_generations WHERE id=$1 LIMIT 1', [id]);
  return result.rows[0] || null;
}

export async function listGenerationsFromDatabase(limit = 100, ownerUserId = null) {
  const db = getPool();
  if (!db) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const result = ownerUserId
    ? await db.query('SELECT * FROM media_generations WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT $2', [ownerUserId, safeLimit])
    : await db.query('SELECT * FROM media_generations ORDER BY created_at DESC LIMIT $1', [safeLimit]);
  return result.rows;
}


export async function createUser({ email, passwordHash, displayName = '' }) {
  const db = getPool();
  if (!db) throw new Error('Database is not configured.');
  const id = 'user-' + crypto.randomUUID();
  const result = await db.query(
    'INSERT INTO app_users (id,email,password_hash,display_name) VALUES ($1,$2,$3,$4) RETURNING id,email,display_name,created_at',
    [id, String(email).trim().toLowerCase(), passwordHash, String(displayName).trim()]
  );
  return result.rows[0];
}

export async function getUserByEmail(email) {
  const db = getPool();
  if (!db) return null;
  const result = await db.query('SELECT * FROM app_users WHERE email=$1 LIMIT 1', [String(email).trim().toLowerCase()]);
  return result.rows[0] || null;
}

export async function getUserById(id) {
  const db = getPool();
  if (!db || !id) return null;
  const result = await db.query('SELECT id,email,display_name,sessions_revoked_at,mfa_secret,mfa_enabled,created_at FROM app_users WHERE id=$1 LIMIT 1', [id]);
  return result.rows[0] || null;
}


export async function saveJobToDatabase(job) {
  const db = getPool();
  if (!db || !job?.id) return false;
  if (dbOwnerId(job.ownerUserId) === null) throw new Error('A persisted job requires an authenticated owner.');
  await db.query(
    `INSERT INTO media_jobs
      (id, owner_user_id, type, status, created_at, started_at, completed_at, cancelled_at, attempts, retry_of, result, error, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (id) DO UPDATE SET
       status=EXCLUDED.status,
       started_at=EXCLUDED.started_at,
       completed_at=EXCLUDED.completed_at,
       cancelled_at=EXCLUDED.cancelled_at,
       attempts=EXCLUDED.attempts,
       retry_of=EXCLUDED.retry_of,
       result=EXCLUDED.result,
       error=EXCLUDED.error,
       payload=COALESCE(EXCLUDED.payload, media_jobs.payload)`,
    [
      job.id, job.ownerUserId || null, job.type || 'job', job.status || 'queued',
      job.createdAt || new Date().toISOString(), job.startedAt || null, job.completedAt || null,
      job.cancelledAt || null, Number(job.attempts || 1), job.retryOf || null,
      JSON.stringify(job.result ?? null), job.error || null, JSON.stringify(job.payload ?? null)
    ]
  );
  return true;
}

export async function consumeRateLimitFromDatabase(bucketKey, { limit = 60, windowMs = 60_000 } = {}) {
  const db = getPool();
  if (!db) return null;
  const now = Date.now();
  const windowStart = new Date(now - windowMs);
  const result = await db.query(
    `INSERT INTO rate_limit_buckets (bucket_key, window_started_at, request_count, updated_at)
     VALUES ($1, NOW(), 1, NOW())
     ON CONFLICT (bucket_key) DO UPDATE SET
       window_started_at = CASE
         WHEN rate_limit_buckets.window_started_at < $2 THEN NOW()
         ELSE rate_limit_buckets.window_started_at
       END,
       request_count = CASE
         WHEN rate_limit_buckets.window_started_at < $2 THEN 1
         ELSE rate_limit_buckets.request_count + 1
       END,
       updated_at = NOW()
     RETURNING window_started_at, request_count`,
    [bucketKey, windowStart]
  );
  const row = result.rows[0];
  const started = new Date(row.window_started_at).getTime();
  const retryAfterMs = Math.max(0, windowMs - (now - started));
  return {
    allowed: Number(row.request_count) <= limit,
    remaining: Math.max(0, limit - Number(row.request_count)),
    retryAfterMs
  };
}

export async function claimJob(jobId, ownerUserId = null, workerId = 'worker') {
  const db = getPool();
  if (!db || !jobId) return true;
  if (dbOwnerId(ownerUserId) === null) return false;
  const result = await db.query(
    `UPDATE media_jobs
        SET status='running', started_at=COALESCE(started_at, NOW()),
            worker_id=$3, lease_until=NOW() + INTERVAL '2 minutes'
      WHERE id=$1 AND status='queued'
        AND owner_user_id=$2
      RETURNING id`,
    [jobId, ownerUserId || null, workerId]
  );
  return result.rowCount === 1;
}

export async function heartbeatJob(jobId, workerId) {
  const db = getPool();
  if (!db || !jobId || !workerId) return true;
  const result = await db.query(
    `UPDATE media_jobs SET lease_until=NOW() + INTERVAL '2 minutes'
      WHERE id=$1 AND status='running' AND worker_id=$2 RETURNING id`,
    [jobId, workerId]
  );
  return result.rowCount === 1;
}

export async function releaseJobClaim(jobId, workerId = null) {
  const db = getPool();
  if (!db || !jobId) return true;
  await db.query(
    `UPDATE media_jobs SET worker_id=NULL, lease_until=NULL
      WHERE id=$1 AND ($2::text IS NULL OR worker_id=$2)`,
    [jobId, workerId]
  );
  return true;
}

export async function recoverableJobsFromDatabase(ownerUserId = null, limit = 100) {
  const db = getPool();
  if (!db) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  await db.query(
    `UPDATE media_jobs SET status='queued', started_at=NULL, worker_id=NULL, lease_until=NULL,
      error=COALESCE(error, 'Job lease expired; re-queued after worker recovery.')
      WHERE status='running' AND lease_until IS NOT NULL AND lease_until < NOW()`
  );
  const result = ownerUserId
    ? await db.query(
        `SELECT * FROM media_jobs
         WHERE status='queued' AND owner_user_id=$1
         ORDER BY created_at ASC LIMIT $2`,
        [ownerUserId, safeLimit]
      )
    : await db.query(
        `SELECT * FROM media_jobs WHERE status='queued'
         ORDER BY created_at ASC LIMIT $1`,
        [safeLimit]
      );
  return result.rows;
}

export async function markRunningJobsInterrupted() {
  return 0;
}

export async function listJobsFromDatabase(ownerUserId = null, limit = 100, projectId = null) {
  const db = getPool();
  if (!db) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const result = ownerUserId
    ? projectId
      ? await db.query("SELECT * FROM media_jobs WHERE owner_user_id=$1 AND result->>'project_id'=$2 ORDER BY created_at DESC LIMIT $3", [ownerUserId, projectId, safeLimit])
      : await db.query('SELECT * FROM media_jobs WHERE owner_user_id=$1 ORDER BY created_at DESC LIMIT $2', [ownerUserId, safeLimit])
    : projectId
      ? await db.query("SELECT * FROM media_jobs WHERE result->>'project_id'=$1 ORDER BY created_at DESC LIMIT $2", [projectId, safeLimit])
      : await db.query('SELECT * FROM media_jobs ORDER BY created_at DESC LIMIT $1', [safeLimit]);
  return result.rows;
}


export async function revokeUserSessions(userId) {
  const db = getPool();
  if (!db || !userId || userId === 'admin') return false;
  await db.query('UPDATE app_users SET sessions_revoked_at=NOW() WHERE id=$1', [userId]);
  return true;
}

export async function updateUserMfa(userId, { secret, enabled }) {
  const db = getPool();
  if (!db || !userId) return false;
  await db.query('UPDATE app_users SET mfa_secret=$2, mfa_enabled=$3 WHERE id=$1', [userId, secret || null, Boolean(enabled)]);
  return true;
}

export async function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  const db = getPool();
  if (!db) return false;
  await db.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE user_id=$1 AND used_at IS NULL', [userId]);
  await db.query('INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,$4)', ['reset-' + crypto.randomUUID(), userId, tokenHash, expiresAt]);
  return true;
}

export async function consumePasswordResetToken(tokenHash) {
  const db = getPool();
  if (!db) return null;
  const result = await db.query('UPDATE password_reset_tokens SET used_at=NOW() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>NOW() RETURNING user_id', [tokenHash]);
  return result.rows[0]?.user_id || null;
}

export async function updateUserPassword(userId, passwordHash) {
  const db = getPool();
  if (!db || !userId) return false;
  await db.query('UPDATE app_users SET password_hash=$2, sessions_revoked_at=NOW() WHERE id=$1', [userId, passwordHash]);
  return true;
}
