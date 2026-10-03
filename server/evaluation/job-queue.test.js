import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobQueue } from '../jobs/queue.js';

test('job queue returns queued state and completes asynchronously', async () => {
  const queue = createJobQueue({ concurrency: 1, maxQueue: 2 });
  const job = queue.enqueue('test', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { ok: true };
  });

  assert.ok(['queued', 'running'].includes(job.status));
  await new Promise(resolve => setTimeout(resolve, 30));
  const completed = queue.get(job.id);
  assert.equal(completed.status, 'completed');
  assert.deepEqual(completed.result, { ok: true });
});
