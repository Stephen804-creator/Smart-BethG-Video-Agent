import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Client, handle_file } from '@gradio/client';
import { findGeneration } from './continuity.js';
import { readSequences, createSequence, addShotToSequence } from './sequences.js';
import { generateWithLuma } from './luma.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const port = Number(process.env.PORT || 8787);
const settingsFile = path.join(root, 'server', 'settings.json');
const outputDir = path.join(root, 'output');
const dataDir = path.join(root, 'data');
const generationsFile = path.join(dataDir, 'generations.jsonl');
const sequencesFile = path.join(dataDir, 'sequences.json');

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/output', express.static(outputDir));

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch {
    return {
      hfSpace: 'Lightricks/ltx-video-distilled',
      hfToken: '',
      lumaApiKey: '',
      lumaModel: 'ray-flash-2',
      comfyUrl: 'http://127.0.0.1:8188'
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

app.get('/api/health', (req, res) => {
  const s = readSettings();
  res.json({ ok: true, service: 'cinematic-agent-v1', providers: { huggingfaceLtx: Boolean(s.hfToken || process.env.HF_TOKEN), luma: Boolean(s.lumaApiKey || process.env.LUMAAI_API_KEY), comfyui: Boolean(s.comfyUrl) } });
});

app.get('/api/settings', (req, res) => {
  const s = readSettings();
  res.json({ hfSpace: s.hfSpace || 'Lightricks/ltx-video-distilled', hfToken: '', hasHFToken: Boolean(s.hfToken || process.env.HF_TOKEN), lumaApiKey: '', hasLumaApiKey: Boolean(s.lumaApiKey || process.env.LUMAAI_API_KEY), lumaModel: s.lumaModel || 'ray-flash-2', comfyUrl: s.comfyUrl || 'http://127.0.0.1:8188' });
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
    const lines = fs.readFileSync(generationsFile, 'utf8').trim().split('\n').filter(Boolean);
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

    if (provider === 'comfyui') return res.status(501).json({ error: 'ComfyUI is not connected yet.', detail: 'The provider slot is reserved for local/open models such as Wan 2.2 and HunyuanVideo.' });

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

app.listen(port, '0.0.0.0', () => console.log(`Cinematic Agent listening on port ${port}`));
