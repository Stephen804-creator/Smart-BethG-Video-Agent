import fs from 'fs';
import path from 'path';
import { normalizeMediaTask, validateMediaTask } from '../workers/media-task.js';
import { createComfyWorker } from '../workers/comfyui-worker.js';
import { listProviders } from '../router/provider-registry.js';
import { chooseProvider } from '../router/scorer.js';

function now() { return new Date().toISOString(); }

export function createProductionRunner({ outputDir, jobsFile, settings, workflowPath }) {
  fs.mkdirSync(path.dirname(jobsFile), { recursive: true });
  function save(job) { fs.appendFileSync(jobsFile, JSON.stringify(job) + '\n'); return job; }
  function readJobs(projectId = null) {
    try { return fs.readFileSync(jobsFile, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(job => !projectId || job.project_id === projectId).reverse(); }
    catch { return []; }
  }
  async function execute(graph, options = {}) {
    const projectId = graph.project_id || 'project';
    const currentSettings = settings();
    const providers = listProviders(currentSettings);
    const comfy = await createComfyWorker({ baseUrl: currentSettings.comfyUrl, workflowPath, outputDir });
    const enriched = providers.map(provider => provider.id === 'comfyui' ? { ...provider, configured: comfy.configured, health: comfy.health } : { ...provider, health: provider.configured ? { ok: true } : { ok: false } });
    const execution = { schema_version: 'production-run-v1', project_id: projectId, jobs: [], started_at: now() };
    const selected = chooseProvider(enriched, { task: 'text-to-video', allowPaid: options.allowPaid === true, preferLocal: options.preferLocal !== false, providerId: options.providerId || '' }).selected;
    for (const node of graph.nodes || []) {
      if (node.type !== 'visual-task') continue;
      const job = { job_id: projectId + ':' + node.task_id, project_id: projectId, task_id: node.task_id, source_node_id: node.id, status: 'queued', created_at: now(), provider: null, worker_id: null, output: null, error: null };
      const operation = node.operation === 'video-generation' ? 'text-to-video' : node.operation;
      if (!['text-to-video', 'image-to-video', 'video-to-video'].includes(operation)) { job.status = 'blocked'; job.error = 'No installed video worker supports this operation.'; execution.jobs.push(save(job)); continue; }
      if (!selected) { job.status = 'blocked'; job.error = 'No eligible configured provider is available. Paid providers are disabled unless explicitly allowed.'; execution.jobs.push(save(job)); continue; }
      if (selected.id !== 'comfyui') { job.status = 'blocked'; job.error = 'Selected provider is registered but has no production runner adapter yet.'; execution.jobs.push(save(job)); continue; }
      try {
        job.status = 'routing'; job.provider = selected.id; job.worker_id = 'comfyui-worker'; save(job);
        const task = normalizeMediaTask({ taskId: job.task_id, domain: 'video', operation, purpose: node.purpose || node.stage, prompt: node.prompt, requirements: node.requirements || {}, constraints: { allowPaid: options.allowPaid === true, preferLocal: true }, metadata: { ...(node.metadata || {}), projectId, sceneId: node.scene_id || null, beatId: node.beat_id || null, shotId: node.shot_id || null } });
        validateMediaTask(task);
        job.status = 'running'; job.started_at = now(); save(job);
        const result = await comfy.execute(task);
        job.status = 'completed'; job.completed_at = now(); job.output = result; save(job);
      } catch (error) { job.status = 'failed'; job.completed_at = now(); job.error = error?.message || 'Worker failed.'; save(job); }
      execution.jobs.push(job);
    }
    execution.finished_at = now();
    execution.summary = { total: execution.jobs.length, completed: execution.jobs.filter(j => j.status === 'completed').length, failed: execution.jobs.filter(j => j.status === 'failed').length, blocked: execution.jobs.filter(j => j.status === 'blocked').length };
    return execution;
  }
  return { execute, readJobs };
}
