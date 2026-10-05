import crypto from 'node:crypto';

export function createJobQueue({
  concurrency = 1,
  maxQueue = 20,
  onChange = null,
  claim = null,
  release = null,
  heartbeat = null
} = {}) {
  const jobs = new Map();
  const pending = [];
  let active = 0;
  let draining = false;

  function snapshot(job) {
    return {
      id: job.id, type: job.type, status: job.status, createdAt: job.createdAt,
      startedAt: job.startedAt || null, completedAt: job.completedAt || null,
      result: job.result || null, error: job.error || null,
      cancelledAt: job.cancelledAt || null, attempts: job.attempts || 1,
      ownerUserId: job.ownerUserId || null, retryOf: job.retryOf || null
    };
  }

  function persisted(job) {
    return { ...snapshot(job), payload: job.payload ?? null };
  }

  function persist(job) {
    try { if (typeof onChange === 'function') onChange(persisted(job)); } catch {}
  }

  async function drain() {
    if (draining) return;
    draining = true;
    try {
      while (active < concurrency && pending.length) {
        const job = pending.shift();
        if (!job || job.status === 'cancelled') continue;

        if (typeof claim === 'function') {
          let claimed = false;
          try { claimed = await claim(job.id, job.ownerUserId); }
          catch (error) {
            job.status = 'failed';
            job.error = error?.message || 'Could not claim queued job.';
            job.completedAt = new Date().toISOString();
            persist(job);
            continue;
          }
          if (!claimed) { jobs.delete(job.id); continue; }
        }

        active += 1;
        job.status = 'running';
        job.startedAt = new Date().toISOString();
        persist(job);

        const controller = new AbortController();
        job.controller = controller;

        const heartbeatTimer = typeof heartbeat === 'function'
          ? setInterval(() => { void heartbeat(job.id, job.ownerUserId); }, 30_000)
          : null;

        Promise.resolve()
          .then(() => job.task(controller.signal))
          .then(result => {
            if (job.cancelRequested || controller.signal.aborted) {
              job.status = 'cancelled';
              job.cancelledAt = job.cancelledAt || new Date().toISOString();
              job.result = null;
              return;
            }
            job.status = 'completed';
            job.result = result;
          })
          .catch(error => {
            if (job.cancelRequested || controller.signal.aborted || error?.name === 'AbortError' || error?.code === 'JOB_CANCELLED') {
              job.status = 'cancelled';
              job.cancelledAt = job.cancelledAt || new Date().toISOString();
              job.error = null;
              return;
            }
            job.status = 'failed';
            job.error = error?.message || 'Job failed.';
          })
          .finally(async () => {
            job.completedAt = new Date().toISOString();
            job.controller = null;
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            persist(job);
            try { if (typeof release === 'function') await release(job.id); } catch {}
            jobs.delete(job.id);
            active -= 1;
            void drain();
          });
      }
    } finally {
      draining = false;
    }
  }

  function enqueue(type, task, metadata = {}) {
    if (typeof task !== 'function') throw new TypeError('A job task function is required.');
    if (pending.length >= maxQueue) {
      const error = new Error('Generation queue is full. Try again later.');
      error.statusCode = 429;
      throw error;
    }
    const job = {
      id: metadata.id || crypto.randomUUID(), type, status: 'queued',
      createdAt: metadata.createdAt || new Date().toISOString(), task,
      taskFactory: task, payload: metadata.payload ?? null,
      attempts: Number(metadata.attempts || 1), ownerUserId: metadata.ownerUserId || null,
      retryOf: metadata.retryOf || null, cancelRequested: false, controller: null
    };
    jobs.set(job.id, job);
    pending.push(job);
    persist(job);
    void drain();
    return snapshot(job);
  }

  function restore(record, task) {
    if (!record?.id || typeof task !== 'function' || jobs.has(record.id)) return null;
    const job = {
      id: record.id, type: record.type || 'job', status: 'queued',
      createdAt: record.createdAt || new Date().toISOString(), startedAt: null,
      completedAt: null, result: null, error: null, cancelledAt: null,
      attempts: Number(record.attempts || 1), ownerUserId: record.ownerUserId || null,
      retryOf: record.retryOf || null, payload: record.payload ?? null, task,
      taskFactory: task, cancelRequested: false, controller: null
    };
    jobs.set(job.id, job);
    pending.push(job);
    return snapshot(job);
  }

  async function recover(records = [], taskResolver) {
    if (!Array.isArray(records) || typeof taskResolver !== 'function') return [];
    const restored = [];
    for (const record of records) {
      try {
        const task = await taskResolver(record);
        const job = restore(record, task);
        if (job) restored.push(job);
      } catch {}
    }
    void drain();
    return restored;
  }

  function get(id) { const job = jobs.get(id); return job ? snapshot(job) : null; }

  function cancel(id) {
    const job = jobs.get(id);
    if (!job) return null;
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return snapshot(job);
    job.cancelRequested = true;
    job.cancelledAt = new Date().toISOString();
    if (job.status === 'queued') {
      job.status = 'cancelled';
      persist(job);
      jobs.delete(job.id);
    } else if (job.controller && !job.controller.signal.aborted) {
      job.controller.abort(new Error('Job cancelled by user.'));
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
    return enqueue(original.type, original.taskFactory, {
      payload: original.payload, attempts: (original.attempts || 1) + 1,
      retryOf: original.id, ownerUserId: original.ownerUserId
    });
  }

  function ownedGet(id, ownerUserId) {
    const job = jobs.get(id);
    return job && (!job.ownerUserId || job.ownerUserId === ownerUserId) ? snapshot(job) : null;
  }
  function ownedCancel(id, ownerUserId) {
    const job = jobs.get(id);
    if (!job || (job.ownerUserId && job.ownerUserId !== ownerUserId)) return null;
    return cancel(id);
  }
  function ownedRetry(id, ownerUserId) {
    const job = jobs.get(id);
    if (!job || (job.ownerUserId && job.ownerUserId !== ownerUserId)) return null;
    return retry(id);
  }

  return { enqueue, recover, get, cancel, retry, ownedGet, ownedCancel, ownedRetry, size: () => pending.length + active };
}
