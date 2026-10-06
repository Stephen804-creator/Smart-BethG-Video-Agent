import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { getComfyHealth, queueComfyWorkflow, getComfyHistory, getComfyViewUrl } from '../comfyui.js';
import { normalizeMediaTask, validateMediaTask } from './media-task.js';

function sleep(ms, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason || Object.assign(new Error('Operation cancelled.'), { name: 'AbortError' }));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason || Object.assign(new Error('Operation cancelled.'), { name: 'AbortError' }));
    }, { once: true });
  });
}

function replaceLiteral(value, token, replacement) {
  return String(value).split(token).join(String(replacement ?? ''));
}

function replacePlaceholders(value, task) {
  if (typeof value === 'string') {
    return replaceLiteral(replaceLiteral(replaceLiteral(replaceLiteral(
      replaceLiteral(replaceLiteral(replaceLiteral(value,
        '{{prompt}}', task.prompt),
        '{{negative_prompt}}', task.negativePrompt),
        '{{seed}}', String(task.metadata.seed ?? Math.floor(Math.random() * 2147483647))),
        '{{width}}', String(task.requirements.width)),
        '{{height}}', String(task.requirements.height)),
        '{{duration}}', String(task.requirements.duration)),
        '{{frames}}', String(Math.max(1, Math.round(task.requirements.duration * 16))));
  }

  if (Array.isArray(value)) return value.map(item => replacePlaceholders(item, task));

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replacePlaceholders(item, task)]));
  }

  return value;
}

function findMediaOutput(history) {
  const outputs = Object.values(history?.outputs || {});

  for (const nodeOutput of outputs) {
    for (const key of ['gifs', 'videos', 'images']) {
      const items = Array.isArray(nodeOutput?.[key]) ? nodeOutput[key] : [];
      const item = items.find(entry => entry?.filename);
      if (item) return item;
    }
  }

  return null;
}

export async function createComfyWorker({ baseUrl, workflowPath, outputDir }) {
  const health = await getComfyHealth(baseUrl);

  return {
    id: 'comfyui-worker',
    runtime: 'comfyui',
    configured: Boolean(workflowPath),
    health,

    async execute(input, { signal } = {}) {
      const task = normalizeMediaTask(input);
      validateMediaTask(task);

      if (!workflowPath) {
        throw new Error('COMFYUI_WORKFLOW_PATH is not configured. Add an API-format ComfyUI workflow JSON before starting a GPU test.');
      }

      if (!fs.existsSync(workflowPath)) {
        throw new Error(`ComfyUI workflow file not found: ${workflowPath}`);
      }

      if (!health.ok) {
        throw new Error(`ComfyUI worker is unreachable: ${health.detail || 'unknown error'}`);
      }

      const template = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
      const workflow = replacePlaceholders(template, task);
      const clientId = `cinematic-agent-${crypto.randomUUID()}`;
      const queued = await queueComfyWorkflow(baseUrl, workflow, clientId);

      const promptId = queued?.prompt_id;
      if (!promptId) throw new Error('ComfyUI accepted the request but returned no prompt_id.');

      const deadline = Date.now() + 20 * 60 * 1000;
      let history = null;

      while (Date.now() < deadline) {
        await sleep(2000, signal);
        history = await getComfyHistory(baseUrl, promptId);
        const entry = history?.[promptId];

        if (entry?.status?.status_str === 'error' || entry?.status?.status_str === 'failed') {
          throw new Error(entry.status?.messages?.map(item => JSON.stringify(item)).join('; ') || 'ComfyUI workflow failed.');
        }

        const media = findMediaOutput(entry);
        if (media) {
          fs.mkdirSync(outputDir, { recursive: true });
          const sourceUrl = getComfyViewUrl(baseUrl, media);
          const response = await fetch(sourceUrl, { signal });
          if (!response.ok) throw new Error(`ComfyUI produced an output, but it could not be downloaded (HTTP ${response.status}).`);

          const filename = `${Date.now()}-${promptId.slice(0, 8)}.mp4`;
          const outputPath = path.join(outputDir, filename);
          fs.writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));

          return {
            promptId,
            clientId,
            output: `/output/${filename}`,
            filename,
            source: media,
            task
          };
        }
      }

      throw new Error('ComfyUI generation timed out after 20 minutes.');
    }
  };
}
