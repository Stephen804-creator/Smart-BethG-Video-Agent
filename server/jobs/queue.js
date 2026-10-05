import crypto from 'node:crypto';

export function createJobQueue({ concurrency = 1, maxQueue = 20, onChange = null } = {}) {
  const jobs = new Map();
  const pending = [];
  let active = 0;

  function persist(job) { try { if (typeof onChange === 'function') onChange(snapshot(job)); } catch {} }

  function snapshot(job) {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt || null,
      completedAt: job.completedAt || null,
      result: job.result || null,
      error: job.error || null,
      cancelledAt: job.cancelledAt || null,
      attempts: job.attempts || 1,
      ownerUserId: job.ownerUserId || null,
      retryOf: job.retryOf || null
    };
  }

  async function drain() {
    while (active < concurrency && pending.length) {
      const job = pending.shift();
      if (!job || job.status === 'cancelled') continue;
      active += 1;
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      persist(job);
      Promise.resolve()
        .then(job.task)
        .then(result => {
          if (job.cancelRequested) { job.status = 'cancelled'; job.cancelledAt = new Date().toISOString(); return; }
          job.status = 'completed';
          job.result = result;
          persist(job);
        })
        .catch(error => {
          if (job.cancelRequested) { job.status = 'cancelled'; job.cancelledAt = new Date().toISOString(); return; }
          job.status = 'failed';
          job.error = error?.message || 'Job failed.';
          persist(job);
        })
        .finally(() => {
          job.completedAt = new Date().toISOString();
          persist(job);
          active -= 1;
          void drain();
        });
    }
  }

  function enqueue(type, task, metadata = {}) {
    if (pending.length >= maxQueue) {
      const error = new Error('Generation queue is full. Try again later.');
      error.statusCode = 429;
      throw error;
    }
    const job = {
      id: crypto.randomUUID(),
      type,
      status: 'queued',
      createdAt: new Date().toISOString(),
      task,
      taskFactory: task,
      attempts: 1,
      ownerUserId: metadata.ownerUserId || null,
      cancelRequested: false
    };
    jobs.set(job.id, job);
    pending.push(job);
    void drain();
    return snapshot(job);
  }

  function get(id) {
    const job = jobs.get(id);
    return job ? snapshot(job) : null;
  }

  function cancel(id) {
    const job = jobs.get(id);
    if (!job) return null;
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return snapshot(job);
    job.cancelRequested = true;
    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.cancelledAt = new Date().toISOString();
      persist(job);
    }
    return snapshot(job);
  }

  function retry(id) {
    const original = jobs.get(id);
    if (!original) return null;
    if (!['failed', 'cancelled'].includes(original.status)) {
      const error = new Error('Only failed or cancelled jobs can be retried.');
      error.statusCode = 409;
      throw error;
    }
    const retryJob = {
      id: crypto.randomUUID(),
      type: original.type,
      status: 'queued',
      createdAt: new Date().toISOString(),
      task: original.taskFactory,
      taskFactory: original.taskFactory,
      attempts: (original.attempts || 1) + 1,
      retryOf: original.id,
      ownerUserId: original.ownerUserId || null,
      cancelRequested: false
    };
    if (pending.length >= maxQueue) {
      const error = new Error('Generation queue is full. Try again later.');
      error.statusCode = 429;
      throw error;
    }
    jobs.set(retryJob.id, retryJob);
    pending.push(retryJob);
    void drain();
    return snapshot(retryJob);
  }

  function ownedGet(id, ownerUserId) { const job = jobs.get(id); return job && (!job.ownerUserId || job.ownerUserId === ownerUserId) ? snapshot(job) : null; }
  function ownedCancel(id, ownerUserId) { const job = jobs.get(id); if (!job || (job.ownerUserId && job.ownerUserId !== ownerUserId)) return null; return cancel(id); }
  function ownedRetry(id, ownerUserId) { const job = jobs.get(id); if (!job || (job.ownerUserId && job.ownerUserId !== ownerUserId)) return null; return retry(id); }

  return { enqueue, get, cancel, retry, ownedGet, ownedCancel, ownedRetry, size: () => pending.length + active };
}
