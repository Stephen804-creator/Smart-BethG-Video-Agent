import fs from 'fs';
import path from 'path';
import { normalizeMediaTask, validateMediaTask } from '../workers/media-task.js';
import { createComfyWorker } from '../workers/comfyui-worker.js';
import { listProviders } from '../router/provider-registry.js';
import { chooseProvider } from '../router/scorer.js';
import { createDatasetRecord, appendDatasetRecord } from '../dataset/manifest.js';
import { evaluateVideoFile } from '../evaluation/video-qc.js';
import { saveGenerationToDatabase } from '../database.js';
import { assertSafeComfyUrl } from '../security/outbound.js';

function now() { return new Date().toISOString(); }

export function createProductionRunner({ outputDir, jobsFile, settings, workflowPath, executeTask = null }) {
  fs.mkdirSync(path.dirname(jobsFile), { recursive: true });
  const datasetFile = path.join(path.dirname(jobsFile), 'dataset-manifest.jsonl');

  function save(job) {
    fs.appendFileSync(jobsFile, JSON.stringify(job) + '\n');
    return job;
  }

  function readJobs(projectId = null) {
    try {
      const rows = fs.readFileSync(jobsFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line))
        .filter(job => !projectId || job.project_id === projectId);
      const latest = new Map();
      for (const job of rows) latest.set(job.job_id, job);
      return [...latest.values()].reverse();
    } catch {
      return [];
    }
  }

  async function execute(graph, options = {}) {
    const projectId = graph.project_id || 'project';
    const currentSettings = settings();
    const providers = listProviders(currentSettings);
    const safeComfyUrl = await assertSafeComfyUrl(currentSettings.comfyUrl);
    const comfy = await createComfyWorker({
      baseUrl: safeComfyUrl,
      workflowPath,
      outputDir
    });

    const enriched = providers.map(provider =>
      provider.id === 'comfyui'
        ? { ...provider, configured: comfy.configured, health: comfy.health }
        : { ...provider, health: provider.configured ? { ok: true } : { ok: false } }
    );

    const execution = {
      schema_version: 'production-run-v2',
      project_id: projectId,
      jobs: [],
      started_at: now(),
      routing_policy: {
        paid_allowed: options.allowPaid === true,
        prefer_local: options.preferLocal !== false,
        explicit_provider: options.providerId || null
      }
    };

    for (const node of graph.nodes || []) {
      if (node.type !== 'visual-task') continue;

      const taskId = node.task_id || node.id;
      const operation = node.operation === 'video-generation' ? 'text-to-video' : node.operation;
      const job = {
        job_id: projectId + ':' + taskId,
        project_id: projectId,
        task_id: taskId,
        source_node_id: node.id,
        scene_id: node.scene_id || null,
        shot_id: node.shot_id || null,
        beat_id: node.beat_id || null,
        status: 'queued',
        created_at: now(),
        provider: null,
        worker_id: null,
        output: null,
        error: null
      };

      if (!['text-to-video', 'image-to-video', 'video-to-video'].includes(operation)) {
        job.status = 'blocked';
        job.error = 'No installed video worker supports this operation.';
        execution.jobs.push(save(job));
        continue;
      }

      const task = normalizeMediaTask({
        taskId,
        domain: 'video',
        operation,
        purpose: node.purpose || node.stage,
        prompt: node.prompt || '',
        negativePrompt: node.negativePrompt || '',
        input: node.input || null,
        requirements: node.requirements || {},
        constraints: { allowPaid: options.allowPaid === true, preferLocal: options.preferLocal !== false, maxCost: options.maxCost ?? null },
        continuity: node.continuity || {},
        metadata: { ...(node.metadata || {}), projectId, sceneId: job.scene_id, beatId: job.beat_id, shotId: job.shot_id, graphNodeId: node.id }
      });
      validateMediaTask(task);

      if (executeTask) {
        try {
          job.status = 'running';
          job.started_at = now();
          save(job);
          const result = await executeTask({
            ...task,
            providerId: options.providerId || 'auto',
            allowPaid: options.allowPaid === true,
            projectId,
            sceneId: job.scene_id,
            shotId: job.shot_id
          });
          job.status = 'completed';
          job.completed_at = now();
          job.output = result?.videoUrl || result?.generation?.output || result;
          job.evaluation = result?.qualityControl || null;
          save(job);
        } catch (error) {
          job.status = 'failed';
          job.completed_at = now();
          job.error = error?.message || 'Canonical media pipeline failed.';
          save(job);
        }
        execution.jobs.push(job);
        continue;
      }

      const selected = chooseProvider(enriched, {
        task: operation,
        allowPaid: options.allowPaid === true,
        preferLocal: options.preferLocal !== false,
        providerId: options.providerId || ''
      }).selected;

      if (!selected) {
        job.status = 'blocked';
        job.error = 'No eligible configured provider is available. Paid providers are disabled unless explicitly allowed.';
        execution.jobs.push(save(job));
        continue;
      }

      if (selected.id !== 'comfyui') {
        job.status = 'blocked';
        job.provider = selected.id;
        job.error = 'Selected provider is registered but has no production runner adapter yet.';
        execution.jobs.push(save(job));
        continue;
      }

      try {
        job.status = 'routing';
        job.provider = selected.id;
        job.worker_id = comfy.id;
        save(job);

        const task = normalizeMediaTask({
          taskId,
          domain: 'video',
          operation,
          purpose: node.purpose || node.stage,
          prompt: node.prompt || '',
          negativePrompt: node.negativePrompt || '',
          input: node.input || null,
          requirements: node.requirements || {},
          constraints: {
            allowPaid: options.allowPaid === true,
            preferLocal: options.preferLocal !== false,
            maxCost: options.maxCost ?? null
          },
          continuity: node.continuity || {},
          metadata: {
            ...(node.metadata || {}),
            projectId,
            sceneId: job.scene_id,
            beatId: job.beat_id,
            shotId: job.shot_id,
            graphNodeId: node.id
          }
        });

        validateMediaTask(task);
        job.status = 'running';
        job.started_at = now();
        save(job);

        const result = await comfy.execute(task);
        let evaluation = {};
        try {
          const outputPath = path.join(outputDir, path.basename(String(result.output || '').replace(/^\/output\//, '')));
          evaluation = await evaluateVideoFile(outputPath, { requestedDuration: task.requirements?.duration || null, frameOutputRoot: path.join(path.dirname(jobsFile), 'evaluation-frames') });
        } catch (error) {
          evaluation = { decision: 'UNAVAILABLE', findings: [{ severity: 'REVIEW', code: 'QC_UNAVAILABLE', message: error?.message || 'Quality control unavailable.' }] };
        }
        const datasetRecord = createDatasetRecord({
          task,
          result,
          worker: { id: comfy.id, provider: 'comfyui', runtime: comfy.runtime },
          evaluation,
          soundPlan: task.sound || null,
          knowledgeRefs: task.metadata?.knowledgeRefs || []
        });
        appendDatasetRecord(datasetFile, datasetRecord);
        try { await saveGenerationToDatabase(datasetRecord); } catch (error) { console.error('Production result saved locally; database write failed:', error); }
        job.status = 'completed';
        job.completed_at = now();
        job.output = result;
        job.evaluation = evaluation;
        job.dataset_record_id = datasetRecord.dataset_id;
        save(job);
      } catch (error) {
        job.status = 'failed';
        job.completed_at = now();
        job.error = error?.message || 'Worker failed.';
        save(job);
      }

      execution.jobs.push(job);
    }

    execution.finished_at = now();
    execution.summary = {
      total: execution.jobs.length,
      completed: execution.jobs.filter(j => j.status === 'completed').length,
      failed: execution.jobs.filter(j => j.status === 'failed').length,
      blocked: execution.jobs.filter(j => j.status === 'blocked').length
    };
    return execution;
  }

  return { execute, readJobs };
}
