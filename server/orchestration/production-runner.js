import fs from 'fs';
import crypto from 'node:crypto';
import path from 'path';
import { normalizeMediaTask, validateMediaTask } from '../workers/media-task.js';

function now() { return new Date().toISOString(); }

export function createProductionRunner({ jobsFile, executeTask, persistJob = null, readPersistedJobs = null }) {
  if (typeof executeTask !== 'function') throw new Error('The production runner requires the canonical media execution function.');
  fs.mkdirSync(path.dirname(jobsFile), { recursive: true });

  async function save(job) {
    if (typeof persistJob === 'function') await persistJob({ id: job.job_id, type: 'production-execution', status: job.status, createdAt: job.created_at, startedAt: job.started_at, completedAt: job.completed_at, result: job, error: job.error || null });
    return job;
  }

  async function readJobs(projectId = null) {
    if (typeof readPersistedJobs === 'function') return readPersistedJobs(projectId);
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
    const execution = {
      schema_version: 'production-run-v3',
      project_id: projectId,
      jobs: [],
      started_at: now(),
      routing_policy: {
        paid_allowed: options.allowPaid === true,
        explicit_provider: options.providerId || null
      }
    };

    for (const node of graph.nodes || []) {
      if (options.signal?.aborted) throw options.signal.reason || Object.assign(new Error('Production execution cancelled.'), { name: 'AbortError' });
      if (node.type !== 'visual-task') continue;
      const taskId = node.task_id || node.id;
      const operation = node.operation === 'video-generation' ? 'text-to-video' : node.operation;
      const job = {
        job_id: 'production-' + crypto.randomUUID(),
        project_id: projectId,
        task_id: taskId,
        source_node_id: node.id,
        scene_id: node.scene_id || null,
        shot_id: node.shot_id || null,
        beat_id: node.beat_id || null,
        status: 'queued',
        created_at: now(),
        provider: options.providerId || 'auto',
        output: null,
        error: null
      };

      try {
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
        job.status = 'running';
        job.started_at = now();
        await save(job);

        const result = await executeTask({
          ...task,
          providerId: options.providerId || 'auto',
          allowPaid: options.allowPaid === true,
          ownerUserId: options.ownerUserId || null,
          projectId,
          sceneId: job.scene_id,
          shotId: job.shot_id,
          signal: options.signal || null
        });

        job.status = 'completed';
        job.completed_at = now();
        job.provider = result?.generation?.provider || result?.provider || job.provider;
        job.output = result?.videoUrl || result?.generation?.output || result;
        job.evaluation = result?.qualityControl || null;
        await save(job);
      } catch (error) {
        job.status = 'failed';
        job.completed_at = now();
        job.error = error?.message || 'Canonical media pipeline failed.';
        await save(job);
      }

      execution.jobs.push(job);
    }

    execution.finished_at = now();
    execution.summary = {
      total: execution.jobs.length,
      completed: execution.jobs.filter(j => j.status === 'completed').length,
      failed: execution.jobs.filter(j => j.status === 'failed').length
    };
    return execution;
  }

  return { execute, readJobs };
}
