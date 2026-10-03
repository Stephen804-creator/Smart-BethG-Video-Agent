import crypto from 'node:crypto';

export function createJobQueue({ concurrency = 1, maxQueue = 20 } = {}) {
  const jobs = new Map();
  const pending = [];
  let active = 0;

  function snapshot(job) {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt || null,
      completedAt: job.completedAt || null,
      result: job.result || null,
      error: job.error || null
    };
  }

  async function drain() {
    while (active < concurrency && pending.length) {
      const job = pending.shift();
      if (!job) continue;
      active += 1;
      job.status = 'running';
      job.startedAt = new Date().toISOString();
      Promise.resolve()
        .then(job.task)
        .then(result => {
          job.status = 'completed';
          job.result = result;
        })
        .catch(error => {
          job.status = 'failed';
          job.error = error?.message || 'Job failed.';
        })
        .finally(() => {
          job.completedAt = new Date().toISOString();
          active -= 1;
          void drain();
        });
    }
  }

  function enqueue(type, task) {
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
      task
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

  return { enqueue, get, size: () => pending.length + active };
}
