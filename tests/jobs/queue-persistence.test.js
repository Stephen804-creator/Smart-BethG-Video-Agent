import test from 'node:test';
import assert from 'node:assert/strict';
import { createJobQueue } from '../../server/jobs/queue.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForTerminal(queue, id) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const job = queue.get(id);
    if (job && ['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    await wait(5);
  }
  throw new Error('Job did not reach a terminal state.');
}

test('job is not claimed or executed until its queued state is durable', async () => {
  const events = [];
  let releaseQueuedWrite;
  const queuedWriteGate = new Promise(resolve => { releaseQueuedWrite = resolve; });

  const queue = createJobQueue({
    onChange: async job => {
      if (job.status === 'queued') {
        events.push('queued-write-start');
        await queuedWriteGate;
        events.push('queued-write-complete');
      } else {
        events.push(`persist-${job.status}`);
      }
    },
    claim: async () => { events.push('claim'); return true; },
    release: async () => { events.push('release'); }
  });

  const queued = queue.enqueue('test', async () => {
    events.push('execute');
    return { ok: true };
  }, { ownerUserId: 'user-1' });

  await wait(20);
  assert.ok(events.includes('queued-write-start'));
  assert.equal(events.includes('claim'), false);
  assert.equal(events.includes('execute'), false);

  releaseQueuedWrite();
  const completed = await waitForTerminal(queue, queued.id);

  assert.equal(completed.status, 'completed');
  assert.ok(events.indexOf('queued-write-complete') < events.indexOf('claim'));
  assert.ok(events.indexOf('claim') < events.indexOf('execute'));
  assert.ok(events.indexOf('execute') < events.indexOf('persist-completed'));
  assert.ok(events.includes('release'));
});

test('a job whose initial durable write fails is not claimed or executed', async () => {
  const events = [];
  const queue = createJobQueue({
    onChange: async job => {
      events.push(`persist-${job.status}`);
      if (job.status === 'queued') throw new Error('database unavailable');
    },
    claim: async () => { events.push('claim'); return true; }
  });

  const queued = queue.enqueue('test', async () => {
    events.push('execute');
    return { ok: true };
  }, { ownerUserId: 'user-2' });

  const failed = await waitForTerminal(queue, queued.id);
  assert.equal(failed.status, 'failed');
  assert.match(failed.error, /could not be persisted/i);
  assert.equal(events.includes('claim'), false);
  assert.equal(events.includes('execute'), false);
});
