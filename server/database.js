import pg from 'pg';

const { Pool } = pg;
let pool = null;

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
    CREATE TABLE IF NOT EXISTS media_projects (
      id TEXT PRIMARY KEY,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_media_generations_project ON media_generations(project_id);
    CREATE INDEX IF NOT EXISTS idx_media_generations_shot ON media_generations(shot_id);
    CREATE INDEX IF NOT EXISTS idx_media_generations_created ON media_generations(created_at DESC);
    ALTER TABLE media_projects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE media_generations ADD COLUMN IF NOT EXISTS dataset_id TEXT;

    CREATE TABLE IF NOT EXISTS media_knowledge_refs (
      generation_id TEXT NOT NULL,
      knowledge_id TEXT NOT NULL,
      PRIMARY KEY (generation_id, knowledge_id)
    );
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

  await db.query(
    `INSERT INTO media_generations
      (id, project_id, scene_id, shot_id, domain, operation, provider, worker_id, model, workflow, prompt, requirements, sound_plan, output, execution, evaluation, licensing, dataset_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     ON CONFLICT (id) DO UPDATE SET
       output=EXCLUDED.output,
       execution=EXCLUDED.execution,
       evaluation=EXCLUDED.evaluation,
       dataset_id=COALESCE(EXCLUDED.dataset_id, media_generations.dataset_id)`,
    [
      id, record.project || record.projectId || null, record.scene || record.sceneId || null, record.shot || record.shotId || null,
      task.domain || record.domain || 'video', task.operation || record.operation || 'text-to-video',
      execution.provider || record.provider || null, execution.worker_id || record.workerId || null,
      execution.model || record.model || null, execution.workflow || record.workflow || null,
      creativeInput.prompt || record.prompt || '', JSON.stringify(creativeInput.requirements || record.requirements || {}),
      JSON.stringify(record.production?.sound || record.soundPlan || {}), JSON.stringify(output),
      JSON.stringify(execution), JSON.stringify(evaluation), JSON.stringify(record.licensing || {}),
      record.dataset_id || null
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
  await db.query(
    `INSERT INTO media_projects (id, name, metadata, updated_at)
     VALUES ($1,$2,$3,NOW())
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, metadata=EXCLUDED.metadata, updated_at=NOW()`,
    [project.id, project.title || 'Untitled Film', JSON.stringify(project)]
  );
  return true;
}

export async function listFilmProjectsFromDatabase() {
  const db = getPool();
  if (!db) return [];
  const result = await db.query('SELECT metadata FROM media_projects ORDER BY updated_at DESC, created_at DESC');
  return result.rows.map(row => row.metadata).filter(project => project && project.id);
}


export async function getGenerationFromDatabase(id) {
  const db = getPool();
  if (!db || !id) return null;
  const result = await db.query('SELECT * FROM media_generations WHERE id=$1 LIMIT 1', [id]);
  return result.rows[0] || null;
}

export async function listGenerationsFromDatabase(limit = 100) {
  const db = getPool();
  if (!db) return [];
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const result = await db.query('SELECT * FROM media_generations ORDER BY created_at DESC LIMIT $1', [safeLimit]);
  return result.rows;
}
