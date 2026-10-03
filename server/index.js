import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { Client, handle_file } from '@gradio/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const app = express();
const port = Number(process.env.PORT || 8787);
const settingsFile = path.join(root, 'server', 'settings.json');
const outputDir = path.join(root, 'output');
const dataDir = path.join(root, 'data');
const generationsFile = path.join(dataDir, 'generations.jsonl');

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

async function generateWithLtx({ prompt, duration, ratio, framing, cameraMovement, lighting }) {
  const shotPrompt = buildShotPrompt({ prompt, framing, cameraMovement, lighting });
  const settings = readSettings();
  const space = settings.hfSpace || 'Lightricks/ltx-video-distilled';
  const token = settings.hfToken || process.env.HF_TOKEN || undefined;
  const dimensions = dimensionsForRatio(ratio);

  const client = await Client.connect(space, {
    ...(token ? { token } : {}),
    events: ['status', 'data']
  });

  const payload = [
    shotPrompt,
    'worst quality, inconsistent motion, blurry, jittery, distorted',
    null,
    null,
    dimensions.height,
    dimensions.width,
    'text-to-video',
    Number(duration),
    9,
    Math.floor(Math.random() * 2147483647),
    true,
    1,
    true
  ];

  const job = client.submit('/text_to_video', payload);
  let finalData = null;
  let lastStatus = null;

  for await (const message of job) {
    if (message.type === 'status') lastStatus = message;
    if (message.type === 'data') finalData = message.data;
  }

  if (!finalData) {
    throw new Error(lastStatus?.message || 'LTX completed without returning a video.');
  }

  const video = getVideoResult(finalData);
  if (!video?.url) {
    throw new Error('LTX returned a result, but no downloadable video URL was provided.');
  }

  const response = await fetch(video.url);
  if (!response.ok) throw new Error(`Could not download generated video (${response.status}).`);

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.mp4`;
  const filepath = path.join(outputDir, filename);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(filepath, buffer);

  const seed = Array.isArray(finalData) && typeof finalData[1] === 'number' ? finalData[1] : null;
  const actualDuration = await probeDuration(filepath);
  const record = {
    id,
    createdAt: new Date().toISOString(),
    provider: 'huggingface',
    space,
    model: 'LTX Video 0.9.8 13B Distilled',
    mode: 'text-to-video',
    prompt,
    generatedPrompt: shotPrompt,
    framing,
    cameraMovement,
    lighting,
    requestedDuration: Number(duration),
    duration: actualDuration ?? Number(duration),
    durationMeasured: actualDuration !== null,
    ratio,
    height: dimensions.height,
    width: dimensions.width,
    seed,
    output: `/output/${filename}`
  };
  appendGeneration(record);

  return {
    provider: 'Hugging Face • LTX Video',
    status: 'Completed',
    videoUrl: `/output/${filename}`,
    generation: record
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'cinematic-agent-v1', provider: 'huggingface-ltx' });
});

app.get('/api/settings', (req, res) => {
  const s = readSettings();
  res.json({
    hfSpace: s.hfSpace || 'Lightricks/ltx-video-distilled',
    hfToken: '',
    hasHFToken: Boolean(s.hfToken || process.env.HF_TOKEN),
    comfyUrl: s.comfyUrl || 'http://127.0.0.1:8188'
  });
});

app.post('/api/settings', (req, res) => {
  const old = readSettings();
  const incoming = req.body || {};
  const settings = {
    hfSpace: incoming.hfSpace || old.hfSpace || 'Lightricks/ltx-video-distilled',
    hfToken: incoming.hfToken && incoming.hfToken !== '••••••••' ? incoming.hfToken : old.hfToken || '',
    comfyUrl: incoming.comfyUrl || old.comfyUrl || 'http://127.0.0.1:8188'
  };
  writeSettings(settings);
  res.json({ ok: true });
});

app.get('/api/generations', (req, res) => {
  try {
    const lines = fs.readFileSync(generationsFile, 'utf8').trim().split('\n').filter(Boolean);
    const records = lines.map(line => JSON.parse(line)).reverse();
    res.json({ records });
  } catch {
    res.json({ records: [] });
  }
});

app.post('/api/generate', async (req, res) => {
  const { provider, prompt, duration, ratio, framing, cameraMovement, lighting } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'A scene description is required.' });

  try {
    if (provider === 'huggingface-ltx') {
      const allowedDurations = [2, 4, 6, 8];
      const safeDuration = allowedDurations.includes(Number(duration)) ? Number(duration) : 2;
      const safeRatio = ['16:9', '9:16', '1:1'].includes(ratio) ? ratio : '16:9';
      return res.json(await generateWithLtx({ prompt: prompt.trim(), duration: safeDuration, ratio: safeRatio, framing, cameraMovement, lighting }));
    }

    if (provider === 'comfyui') {
      return res.status(501).json({
        error: 'ComfyUI is not connected yet.',
        detail: 'The provider interface is reserved for the next engine. The first real engine is Hugging Face LTX.'
      });
    }

    return res.status(400).json({ error: 'Unknown provider.' });
  } catch (error) {
    console.error(error);
    return res.status(502).json({
      error: 'Video generation failed.',
      detail: error?.message || 'Unknown provider error.'
    });
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

app.listen(port, '0.0.0.0', () => {
  console.log(`Cinematic Agent listening on port ${port}`);
});
