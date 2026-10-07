import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProductionRunner } from '../orchestration/production-runner.js';

test('production runner preserves owner identity for every persisted job state', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cinematic-security-'));
  const persisted = [];
  const runner = createProductionRunner({
    jobsFile: path.join(root, 'jobs.jsonl'),
    persistJob: async job => { persisted.push(job); },
    executeTask: async input => ({
      provider: 'test',
      videoUrl: '/output/test.mp4',
      generation: { id: 'gen-test', provider: 'test', output: '/output/test.mp4' },
      ownerUserId: input.ownerUserId
    })
  });

  const ownerUserId = 'user-security-owner';
  const result = await runner.execute({
    project_id: 'project-security',
    nodes: [{ id: 'node-1', type: 'visual-task', operation: 'text-to-video', prompt: 'test', requirements: { duration: 1 } }]
  }, { ownerUserId });

  assert.equal(result.summary.completed, 1);
  assert.ok(persisted.length >= 2);
  assert.ok(persisted.every(job => job.ownerUserId === ownerUserId));
});
