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


test('job queue prevents one user from reading, cancelling, or retrying another user job', async () => {
  const queue = createJobQueue({ concurrency: 1, maxQueue: 3 });
  const job = queue.enqueue('test', async () => {
    throw new Error('intentional failure');
  }, { ownerUserId: 'user-a' });

  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(job.ownerUserId, 'user-a');
  assert.equal(queue.ownedGet(job.id, 'user-b'), null);
  assert.equal(queue.ownedCancel(job.id, 'user-b'), null);
  assert.equal(queue.ownedRetry(job.id, 'user-b'), null);
  assert.equal(queue.ownedGet(job.id, 'user-a').status, 'failed');

  const retry = queue.ownedRetry(job.id, 'user-a');
  assert.equal(retry.ownerUserId, 'user-a');
});
