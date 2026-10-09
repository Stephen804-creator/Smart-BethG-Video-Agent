import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProductionRunner } from '../orchestration/production-runner.js';

test('production execution propagates authenticated owner identity to every generation task', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-owner-'));
  let received = null;
  try {
    const runner = createProductionRunner({
      jobsFile: path.join(root, 'jobs.jsonl'),
      executeTask: async input => {
        received = input;
        return {
          provider: 'test-provider',
          videoUrl: '/output/test.mp4',
          generation: {
            id: 'generation-owner-test',
            ownerUserId: input.ownerUserId,
            output: '/output/test.mp4'
          }
        };
      }
    });
    const result = await runner.execute({
      project_id: 'project-owner-test',
      nodes: [{
        id: 'node-owner-test',
        task_id: 'task-owner-test',
        type: 'visual-task',
        operation: 'text-to-video',
        prompt: 'A simple test scene',
        requirements: { duration: 2, aspectRatio: '16:9' }
      }]
    }, { ownerUserId: 'user-owner-test' });

    assert.equal(received?.ownerUserId, 'user-owner-test');
    assert.equal(result.jobs.length, 1);
    assert.equal(result.jobs[0].status, 'completed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
