import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Client, handle_file } from '@gradio/client';
import { findGeneration } from './continuity.js';
import { readSequences, createSequence, addShotToSequence } from './sequences.js';
import { generateWithLuma } from './luma.js';
import { listProviders } from './router/provider-registry.js';
import { chooseProvider } from './router/scorer.js';
import { getComfyHealth } from './comfyui.js';
import { createComfyWorker } from './workers/comfyui-worker.js';
import { normalizeMediaTask, validateMediaTask } from './workers/media-task.js';
import { prepareExecutionPlan } from './workers/execution-planner.js';
import { createProductionRunner } from './orchestration/production-runner.js';
import { searchKnowledge, getKnowledgeEntry, listKnowledgeDomains, getKnowledgeForTask, validateKnowledgeReferences } from './knowledge/base.js';
import { normalizeSoundPlan } from './sound/schema.js';
import { createDatasetRecord, appendDatasetRecord } from './dataset/manifest.js';
import { buildMediaPlan } from './planning/media-planner.js';
import { buildFormatProductionPlan } from './planning/format-production-planner.js';
import { buildStoryPlan } from './planning/story-planner.js';
import { createFilmStore } from './film-production.js';
import { createAssetStore } from './assets.js';
import { listMediaFormats, getMediaFormat } from './media/formats.js';
import { initDatabase, saveGenerationToDatabase, getDatabaseStatus, upsertWorldEntities, recordEntityEvent, getEntityState, resolveEntityStateAt } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const port = Number(process.env.PORT || 8787);
const settingsFile = path.join(root, 'server', 'settings.json');
const outputDir = path.join(root, 'output');
const dataDir = path.join(root, 'data');
const generationsFile = path.join(dataDir, 'generations.jsonl');
const datasetFile = path.join(dataDir, 'dataset-manifest.jsonl');
const jobsFile = path.join(dataDir, 'production-jobs.jsonl');
const sequencesFile = path.join(dataDir, 'sequences.json');
const filmStore = createFilmStore(path.join(dataDir, 'film-projects.json'));
const assetDir = path.join(dataDir, 'assets');
const assetStore = createAssetStore({ rootDir: assetDir });
const upload = multer({ dest: path.join(dataDir, 'upload-tmp'), limits: { fileSize: 500 * 1024 * 1024 } });
const comfyWorkflowPath = process.env.COMFYUI_WORKFLOW_PATH ? path.resolve(root, process.env.COMFYUI_WORKFLOW_PATH) : '';

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/output', express.static(outputDir));
app.use('/assets', express.static(assetDir));

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch {
    return {
      hfSpace: 'Lightricks/ltx-video-distilled',
      hfToken: '',
      lumaApiKey: '',
      lumaModel: 'ray-flash-2',
      comfyUrl: process.env.COMFYUI_URL || 'http://127.0.0.1:8188'
    };
  }
}

function writeSettings(settings) {
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

function appendGeneration(record) {
  fs.appendFileSync(generationsFile, JSON.stringify(record) + '\n');
}

function dimensionsForRatio(ratio) {
  if (ratio === '9:16') return { height: 896, width: 512 };
  if (ratio === '1:1') return { height: 640, width: 640 };
  return { height: 512, width: 896 };
}

function getVideoResult(data) {
  if (!Array.isArray(data)) return null;
  const first = data[0];
  if (first && typeof first === 'object' && first.video) return first.video;
  if (first && typeof first === 'object' && (first.url || first.path)) return first;
  return null;
}

function probeDuration(filepath) {
  return new Promise((resolve) => {
    const probe = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filepath]);
    let output = '';
    probe.stdout.on('data', chunk => { output += chunk.toString(); });
    probe.on('error', () => resolve(null));
    probe.on('close', code => {
      if (code !== 0) return resolve(null);
      const seconds = Number.parseFloat(output.trim());
      resolve(Number.isFinite(seconds) ? Number(seconds.toFixed(3)) : null);
    });
  });
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

async function runLtxJob(client, endpoint, payload) {
  const job = client.submit(endpoint, payload);
  let finalData = null;
  let lastStatus = null;

  for await (const message of job) {
    if (message.type === 'status') lastStatus = message;
    if (message.type === 'data') finalData = message.data;
  }

  if (!finalData) throw new Error(lastStatus?.message || 'LTX completed without returning a video.');
  return finalData;
}

async function generateWithLtx({ prompt, duration, ratio, framing, cameraMovement, lighting, referenceGenerationId }) {
  const reference = referenceGenerationId ? findGeneration(generationsFile, referenceGenerationId) : null;
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
    const referencePath = path.join(root, reference.output.replace(/^\/output\//, ''));
    if (!fs.existsSync(referencePath)) throw new Error('The selected continuity video is no longer available on the server.');
    mode = 'video-to-video';
    const inputVideo = await handle_file(referencePath);
    finalData = await runLtxJob(client, '/video_to_video', [shotPrompt, 'worst quality, inconsistent motion, blurry, jittery, distorted', null, inputVideo, dimensions.height, dimensions.width, 'video-to-video', Number(duration), 9, seed, true, 1, true]);
  } else {
    finalData = await runLtxJob(client, '/text_to_video', [shotPrompt, 'worst quality, inconsistent motion, blurry, jittery, distorted', null, null, dimensions.height, dimensions.width, 'text-to-video', Number(duration), 9, seed, true, 1, true]);
  }

  const video = getVideoResult(finalData);
  if (!video?.url) throw new Error('LTX returned a result, but no downloadable video URL was provided.');
  const response = await fetch(video.url);
  if (!response.ok) throw new Error(`Could not download generated video (${response.status}).`);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.mp4`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, Buffer.from(await response.arrayBuffer()));
  const actualDuration = await probeDuration(filepath);
  const record = { id, createdAt: new Date().toISOString(), provider: 'huggingface', space, model: 'LTX Video 0.9.8 13B Distilled', mode, prompt, generatedPrompt: shotPrompt, referenceGenerationId: reference?.id || null, framing, cameraMovement, lighting, requestedDuration: Number(duration), duration: actualDuration ?? Number(duration), durationMeasured: actualDuration !== null, ratio, height: dimensions.height, width: dimensions.width, seed, output: `/output/${filename}` };
  appendGeneration(record);
  return { provider: 'Hugging Face • LTX Video', status: 'Completed', videoUrl: `/output/${filename}`, generation: record };
}

async function generateLumaShot({ prompt, ratio, framing, cameraMovement, lighting, referenceGenerationId, model }) {
  const settings = readSettings();
  const apiKey = settings.lumaApiKey || process.env.LUMAAI_API_KEY || '';
  const reference = referenceGenerationId ? findGeneration(generationsFile, referenceGenerationId) : null;
  const finalPrompt = buildShotPrompt({ prompt: [reference ? 'Preserve the established visual identity from the previous shot.' : '', prompt].filter(Boolean).join(' '), framing, cameraMovement, lighting });
  const { generation, videoUrl } = await generateWithLuma({ apiKey, prompt: finalPrompt, ratio, model: model || settings.lumaModel || 'ray-flash-2' });
  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error(`Could not download Luma video (${response.status}).`);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.mp4`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, Buffer.from(await response.arrayBuffer()));
  const actualDuration = await probeDuration(filepath);
  const record = { id, createdAt: new Date().toISOString(), provider: 'luma', model: generation.model || model, mode: 'text-to-video', prompt, generatedPrompt: finalPrompt, referenceGenerationId: reference?.id || null, framing, cameraMovement, lighting, requestedDuration: null, duration: actualDuration, durationMeasured: actualDuration !== null, ratio, width: null, height: null, providerGenerationId: generation.id, output: `/output/${filename}` };
  appendGeneration(record);
  return { provider: `Luma • ${record.model}`, status: 'Completed', videoUrl: `/output/${filename}`, generation: record };
}

app.get('/api/film/projects', (req, res) => {
  res.json({ projects: filmStore.listProjects() });
});

app.post('/api/film/projects', (req, res) => {
  try { res.status(201).json({ project: filmStore.createProject(req.body || {}) }); }
  catch (error) { res.status(400).json({ error: error?.message || 'Could not create film project.' }); }
});

app.get('/api/film/projects/:projectId', (req, res) => {
  const project = filmStore.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.json({ project });
});

app.patch('/api/film/projects/:projectId', (req, res) => {
  const project = filmStore.updateProject(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.json({ project });
});

app.patch('/api/film/projects/:projectId/story', (req, res) => {
  const project = filmStore.updateStory(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.json({ project });
});

app.post('/api/film/projects/:projectId/characters', (req, res) => {
  const project = filmStore.addCharacter(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.status(201).json({ project });
});

app.patch('/api/film/projects/:projectId/characters/:characterId', (req, res) => {
  const project = filmStore.updateCharacter(req.params.projectId, req.params.characterId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project or character not found.' });
  res.json({ project });
});

app.patch('/api/film/projects/:projectId/world', (req, res) => {
  const project = filmStore.updateWorld(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.json({ project });
});

app.post('/api/film/projects/:projectId/scenes', (req, res) => {
  const project = filmStore.addScene(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.status(201).json({ project });
});

app.patch('/api/film/projects/:projectId/scenes/:sceneId', (req, res) => {
  const project = filmStore.updateScene(req.params.projectId, req.params.sceneId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project or scene not found.' });
  res.json({ project });
});

app.post('/api/film/projects/:projectId/shots', (req, res) => {
  const project = filmStore.addShot(req.params.projectId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.status(201).json({ project });
});

app.patch('/api/film/projects/:projectId/shots/:shotId', (req, res) => {
  const project = filmStore.updateShot(req.params.projectId, req.params.shotId, req.body || {});
  if (!project) return res.status(404).json({ error: 'Film project or shot not found.' });
  res.json({ project });
});

app.post('/api/film/projects/:projectId/scenes/:sceneId/reorder', (req, res) => {
  const project = filmStore.reorderScene(req.params.projectId, req.params.sceneId, req.body?.sequence);
  if (!project) return res.status(404).json({ error: 'Film project or scene not found.' });
  res.json({ project });
});

app.post('/api/film/projects/:projectId/shots/:shotId/reorder', (req, res) => {
  const project = filmStore.reorderShot(req.params.projectId, req.params.shotId, req.body?.sequence);
  if (!project) return res.status(404).json({ error: 'Film project or shot not found.' });
  res.json({ project });
});

app.post('/api/film/projects/:projectId/takes', (req, res) => {
  const take = filmStore.addTake(req.params.projectId, req.body || {});
  if (!take) return res.status(404).json({ error: 'Film project not found.' });
  res.status(201).json({ take });
});

app.post('/api/film/projects/:projectId/shots/:shotId/select-take', (req, res) => {
  const project = filmStore.selectTake(req.params.projectId, req.params.shotId, req.body?.takeId);
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.json({ project });
});

app.post('/api/film/projects/:projectId/assets/upload', upload.single('file'), async (req, res) => {
  try {
    const project = filmStore.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Film project not found.' });
    if (!req.file) return res.status(400).json({ error: 'A media file is required.' });
    const stored = await assetStore.saveUploadedFile(req.file);
    const asset = filmStore.addAsset(req.params.projectId, {
      ...stored,
      sceneId: req.body?.sceneId || null,
      shotId: req.body?.shotId || null,
      notes: req.body?.notes || ''
    });
    res.status(201).json({ asset });
  } catch (error) {
    res.status(400).json({ error: error?.message || 'Could not ingest media asset.' });
  }
});

app.patch('/api/film/projects/:projectId/assets/:assetId', (req, res) => {
  const asset = filmStore.updateAsset(req.params.projectId, req.params.assetId, req.body || {});
  if (!asset) return res.status(404).json({ error: 'Film project or asset not found.' });
  res.json({ asset });
});

app.post('/api/film/projects/:projectId/assets/:assetId/attach-shot', (req, res) => {
  const project = filmStore.attachAssetToShot(req.params.projectId, req.params.assetId, req.body?.shotId);
  if (!project) return res.status(404).json({ error: 'Film project, asset or shot not found.' });
  res.json({ project });
});

app.post('/api/film/projects/:projectId/assets/:assetId/attach-take', (req, res) => {
  const project = filmStore.attachAssetToTake(req.params.projectId, req.params.assetId, req.body?.takeId);
  if (!project) return res.status(404).json({ error: 'Film project, asset or take not found.' });
  res.json({ project });
});

app.get('/api/film/projects/:projectId/assets', (req, res) => {
  const project = filmStore.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  res.json({ assets: project.assets || [] });
});

app.post('/api/film/projects/:projectId/assets', (req, res) => {
  const asset = filmStore.addAsset(req.params.projectId, req.body || {});
  if (!asset) return res.status(404).json({ error: 'Film project not found.' });
  res.status(201).json({ asset });
});

app.post('/api/film/projects/:projectId/continuity', (req, res) => {
  const event = filmStore.addContinuityEvent(req.params.projectId, req.body || {});
  if (!event) return res.status(404).json({ error: 'Film project not found.' });
  res.status(201).json({ event });
});

app.post('/api/film/projects/:projectId/assistant', (req, res) => {
  const project = filmStore.getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Film project not found.' });
  const shots = project.shots || [];
  const takes = project.takes || [];
  const advice = [];
  const missing = [];
  if (!project.scenes?.length) advice.push('Create scenes before building the final shot schedule.');
  if (!shots.length) advice.push('Create the first coverage plan: establish the scene, cover the main action, then capture reaction/detail shots.');
  const framings = new Set(shots.map(s => String(s.framing || '').toLowerCase()));
  if (shots.length && ![...framings].some(x => x.includes('wide'))) missing.push('wide/establishing coverage');
  if (shots.length && ![...framings].some(x => x.includes('close'))) missing.push('close-up or reaction coverage');
  const withoutLens = shots.filter(s => !s.lens).length;
  const withoutAudio = shots.filter(s => !s.audio).length;
  const withoutTake = shots.filter(s => !(takes.some(t => t.shotId === s.id))).length;
  if (withoutLens) advice.push(withoutLens + ' shot(s) have no lens recorded. Record the intended focal length before shooting.');
  if (withoutAudio) advice.push(withoutAudio + ' shot(s) have no production-audio note. Decide whether the take needs sync sound, wild track or silence.');
  if (withoutTake) advice.push(withoutTake + ' planned shot(s) have no logged take yet.');
  if (missing.length) advice.push('Coverage to consider next: ' + missing.join(', ') + '.');
  if (!advice.length) advice.push('The current shot and take log has no obvious planning gaps. Review continuity and select the best takes before moving to edit.');
  res.json({
    mode: 'production-review',
    project_id: project.id,
    summary: { scenes: project.scenes?.length || 0, shots: shots.length, takes: takes.length, assets: project.assets?.length || 0 },
    recommendations: advice,
    coverage_gaps: missing,
    next_action: advice[0]
  });
});

app.get('/api/projects/:projectId/entities', async (req, res) => {
  try {
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
    if (!state) return res.status(404).json({ error: 'Entity not found.' });
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Could not resolve entity state.' });
  }
});

app.post('/api/projects/:projectId/entities', async (req, res) => {
  try {
    const entities = Array.isArray(req.body?.entities) ? req.body.entities : [];
    await upsertWorldEntities(req.params.projectId, entities);
    res.json({ ok: true, count: entities.length });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Could not save world entities.' });
  }
});

app.post('/api/projects/:projectId/entity-events', async (req, res) => {
  try {
    await recordEntityEvent({
      projectId: req.params.projectId,
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

app.post('/api/production/execute', async (req, res) => {
  try {
    const graph = req.body?.productionGraph || req.body?.production_graph;
    if (!graph) return res.status(400).json({ error: 'productionGraph is required.' });
    const runner = createProductionRunner({
      outputDir,
      jobsFile,
      settings: readSettings,
      workflowPath: comfyWorkflowPath
    });
    const result = await runner.execute(graph, {
      allowPaid: req.body?.allowPaid === true,
      preferLocal: req.body?.preferLocal !== false,
      providerId: req.body?.providerId || ''
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Production execution failed.' });
  }
});

app.get('/api/production/jobs/:projectId', (req, res) => {
  const runner = createProductionRunner({
    outputDir,
    jobsFile,
    settings: readSettings,
    workflowPath: comfyWorkflowPath
  });
  res.json({ jobs: runner.readJobs(req.params.projectId) });
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
  const worker = await createComfyWorker({ baseUrl: settings.comfyUrl, workflowPath: comfyWorkflowPath, outputDir });
  res.json({ workers: [{ id: worker.id, runtime: worker.runtime, configured: worker.configured, health: worker.health, workflowPathConfigured: Boolean(comfyWorkflowPath) }] });
});

app.post('/api/media/generate', async (req, res) => {
  try {
    const task = normalizeMediaTask(req.body || {});
    task.sound = normalizeSoundPlan(req.body?.sound || {});
    validateMediaTask(task);
    if (req.body?.workerId && req.body.workerId !== 'comfyui-worker') return res.status(400).json({ error: 'Unknown worker.' });
    const settings = readSettings();
    const worker = await createComfyWorker({ baseUrl: settings.comfyUrl, workflowPath: comfyWorkflowPath, outputDir });
    const result = await worker.execute(task);
    const record = { id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), domain: task.domain, operation: task.operation, provider: 'comfyui', workerId: worker.id, model: task.metadata.model || null, workflow: comfyWorkflowPath || null, prompt: task.prompt, requirements: task.requirements, sound: task.sound, output: result.output, promptId: result.promptId, source: result.source };
    const datasetRecord = createDatasetRecord({ task, result, worker, soundPlan: task.sound, knowledgeRefs: task.metadata.knowledgeRefs || [] });
    await saveGenerationToDatabase(datasetRecord);
    appendDatasetRecord(datasetFile, datasetRecord);
    appendGeneration(record);
    res.json({ status: 'Completed', videoUrl: result.output, generation: record });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Media generation failed.', detail: error?.message || 'Unknown worker error.' });
  }
});

app.get('/api/providers', async (req, res) => {
  const settings = readSettings();
  const providers = listProviders(settings);
  const comfy = await getComfyHealth(settings.comfyUrl);
  const enriched = providers.map(provider =>
    provider.id === 'comfyui'
      ? { ...provider, configured: comfy.ok, health: comfy }
      : { ...provider, health: provider.configured ? { ok: true } : { ok: false, detail: 'Not configured.' } }
  );
  const task = String(req.query.task || 'text-to-video');
  const allowPaid = req.query.allowPaid !== 'false';
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

app.get('/api/health', async (req, res) => {
  const s = readSettings();
  const database = await getDatabaseStatus();
  res.json({ ok: true, service: 'cinematic-agent-v1', database, providers: { huggingfaceLtx: Boolean(s.hfToken || process.env.HF_TOKEN), luma: Boolean(s.lumaApiKey || process.env.LUMAAI_API_KEY), comfyui: Boolean(s.comfyUrl) } });
});

app.get('/api/settings', (req, res) => {
  const s = readSettings();
  res.json({ hfSpace: s.hfSpace || 'Lightricks/ltx-video-distilled', hfToken: '', hasHFToken: Boolean(s.hfToken || process.env.HF_TOKEN), lumaApiKey: '', hasLumaApiKey: Boolean(s.lumaApiKey || process.env.LUMAAI_API_KEY), lumaModel: s.lumaModel || 'ray-flash-2', comfyUrl: s.comfyUrl || process.env.COMFYUI_URL || 'http://127.0.0.1:8188' });
});

app.post('/api/settings', (req, res) => {
  const old = readSettings();
  const incoming = req.body || {};
  const settings = {
    hfSpace: incoming.hfSpace || old.hfSpace || 'Lightricks/ltx-video-distilled',
    hfToken: incoming.hfToken && incoming.hfToken !== '••••••••' ? incoming.hfToken : old.hfToken || '',
    lumaApiKey: incoming.lumaApiKey && incoming.lumaApiKey !== '••••••••' ? incoming.lumaApiKey : old.lumaApiKey || '',
    lumaModel: ['ray-flash-2', 'ray-2'].includes(incoming.lumaModel) ? incoming.lumaModel : old.lumaModel || 'ray-flash-2',
    comfyUrl: incoming.comfyUrl || old.comfyUrl || 'http://127.0.0.1:8188'
  };
  writeSettings(settings);
  res.json({ ok: true });
});

app.get('/api/generations', (req, res) => {
  try {
    const lines = fs.readFileSync(generationsFile, 'utf8').trim().split('\\n').filter(Boolean);
    res.json({ records: lines.map(line => JSON.parse(line)).reverse() });
  } catch { res.json({ records: [] }); }
});

app.get('/api/sequences', (req, res) => res.json({ sequences: readSequences(sequencesFile).reverse() }));

app.post('/api/sequences', (req, res) => res.status(201).json({ sequence: createSequence(sequencesFile, req.body?.title) }));

app.post('/api/sequences/:id/shots', (req, res) => {
  const generationId = req.body?.generationId;
  if (!generationId) return res.status(400).json({ error: 'generationId is required.' });
  const sequence = addShotToSequence(sequencesFile, req.params.id, generationId);
  if (!sequence) return res.status(404).json({ error: 'Sequence not found.' });
  res.json({ sequence });
});

app.post('/api/generate', async (req, res) => {
  const { provider, prompt, duration, ratio, framing, cameraMovement, lighting, referenceGenerationId } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'A scene description is required.' });

  try {
    if (provider === 'huggingface-ltx') {
      const safeDuration = [2, 4, 6, 8].includes(Number(duration)) ? Number(duration) : 2;
      const safeRatio = ['16:9', '9:16', '1:1'].includes(ratio) ? ratio : '16:9';
      return res.json(await generateWithLtx({ prompt: prompt.trim(), duration: safeDuration, ratio: safeRatio, framing, cameraMovement, lighting, referenceGenerationId }));
    }

    if (provider === 'luma-ray-flash' || provider === 'luma-ray-2') {
      const safeRatio = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9', '9:21'].includes(ratio) ? ratio : '16:9';
      const model = provider === 'luma-ray-2' ? 'ray-2' : 'ray-flash-2';
      return res.json(await generateLumaShot({ prompt: prompt.trim(), ratio: safeRatio, framing, cameraMovement, lighting, referenceGenerationId, model }));
    }

    if (provider === 'comfyui') {
      const task = normalizeMediaTask({ operation: 'text-to-video', prompt: prompt.trim(), duration, aspectRatio: ratio, requirements: { duration, aspectRatio: ratio, quality: 'standard' }, metadata: { framing, cameraMovement, lighting } });
      validateMediaTask(task);
      const settings = readSettings();
      const worker = await createComfyWorker({ baseUrl: settings.comfyUrl, workflowPath: comfyWorkflowPath, outputDir });
      const generated = await worker.execute(task);
      const record = { id: `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString(), domain: 'video', operation: task.operation, provider: 'comfyui', workerId: worker.id, prompt: task.prompt, requirements: task.requirements, output: generated.output, promptId: generated.promptId, source: generated.source };
      appendGeneration(record);
      return res.json({ provider: 'ComfyUI • Open Models', status: 'Completed', videoUrl: generated.output, generation: record });
    }

    return res.status(400).json({ error: 'Unknown provider.' });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Video generation failed.', detail: error?.message || 'Unknown provider error.' });
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

initDatabase().then(() => {
  app.listen(port, '0.0.0.0', () => console.log(`Cinematic Agent listening on port ${port}`));
}).catch(error => {
  console.error('Database initialization failed:', error?.message || error);
  app.listen(port, '0.0.0.0', () => console.log(`Cinematic Agent listening on port ${port} (database unavailable)`));
});
