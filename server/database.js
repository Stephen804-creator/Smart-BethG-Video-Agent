import pg from 'pg';

const { Pool } = pg;
let pool = null;

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
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
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_media_generations_project ON media_generations(project_id);
    CREATE INDEX IF NOT EXISTS idx_media_generations_shot ON media_generations(shot_id);
    CREATE INDEX IF NOT EXISTS idx_media_generations_created ON media_generations(created_at DESC);

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

  await db.query(
    `INSERT INTO media_generations
      (id, project_id, scene_id, shot_id, domain, operation, provider, worker_id, model, workflow, prompt, requirements, sound_plan, output, execution, evaluation, licensing)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     ON CONFLICT (id) DO UPDATE SET
       output=EXCLUDED.output,
       execution=EXCLUDED.execution,
       evaluation=EXCLUDED.evaluation`,
    [
      record.id,
      record.project || null,
      record.scene || null,
      record.shot || null,
      record.task?.domain || 'video',
      record.task?.operation || 'text-to-video',
      record.execution?.provider || null,
      record.execution?.worker_id || null,
      record.execution?.model || null,
      record.execution?.workflow || null,
      record.creative_input?.prompt || '',
      JSON.stringify(record.creative_input?.requirements || {}),
      JSON.stringify(record.production?.sound || {}),
      JSON.stringify(record.output || {}),
      JSON.stringify(record.execution || {}),
      JSON.stringify(record.evaluation || {}),
      JSON.stringify(record.licensing || {})
    ]
  );

  for (const id of record.knowledge_refs || []) {
    await db.query(
      `INSERT INTO media_knowledge_refs (generation_id, knowledge_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [record.id, id]
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
