import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import request from 'supertest';

const enabled = process.env.RUN_API_TESTS === '1';
let serverProcess;
let api;

async function waitForServer(baseUrl) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl + '/api/health');
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('API server did not become ready.');
}

before(async () => {
  if (!enabled) return;
  if (!process.env.DATABASE_URL) throw new Error('RUN_API_TESTS=1 requires DATABASE_URL.');
  serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: '8787',
      APP_AUTH_PASSWORD: 'unused-in-db-mode',
      APP_ALLOWED_ORIGINS: 'http://127.0.0.1:4173,http://localhost:4173'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', chunk => process.stdout.write(String(chunk)));
  serverProcess.stderr.on('data', chunk => process.stderr.write(String(chunk)));
  await waitForServer('http://127.0.0.1:8787');
  api = request('http://127.0.0.1:8787');
});

after(async () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill('SIGTERM');
});

test('API requires authentication for protected routes', { skip: !enabled }, async () => {
  const response = await api.get('/api/film/projects');
  assert.equal(response.status, 401);
});

test('two users cannot read or mutate each other\'s film projects or jobs', { skip: !enabled }, async () => {
  const suffix = Date.now();
  const userA = request.agent('http://127.0.0.1:8787');
  const userB = request.agent('http://127.0.0.1:8787');

  const registerA = await userA.post('/api/auth/register').send({
    email: `isolation-a-${suffix}@example.test`,
    password: 'correct-horse-battery-1',
    displayName: 'Isolation A'
  });
  const registerB = await userB.post('/api/auth/register').send({
    email: `isolation-b-${suffix}@example.test`,
    password: 'correct-horse-battery-2',
    displayName: 'Isolation B'
  });
  assert.equal(registerA.status, 201);
  assert.equal(registerB.status, 201);

  const created = await userA.post('/api/film/projects').send({ title: 'Private Project A' });
  assert.equal(created.status, 201);
  const projectId = created.body.project.id;

  const ownProject = await userA.get('/api/film/projects/' + projectId);
  assert.equal(ownProject.status, 200);

  const foreignProject = await userB.get('/api/film/projects/' + projectId);
  assert.equal(foreignProject.status, 404);

  const foreignMutation = await userB.post('/api/film/projects/' + projectId + '/scenes')
    .send({ title: 'Should not be allowed' });
  assert.equal(foreignMutation.status, 404);

  const queued = await userA.post('/api/generate').send({
    provider: 'comfyui',
    prompt: 'Isolation test shot',
    duration: 4,
    ratio: '16:9',
    framing: 'medium shot',
    cameraMovement: 'static',
    lighting: 'natural'
  });
  assert.equal(queued.status, 202);
  const jobId = queued.body.job.id;

  const ownJob = await userA.get('/api/jobs/' + jobId);
  assert.equal(ownJob.status, 200);

  const foreignJob = await userB.get('/api/jobs/' + jobId);
  assert.equal(foreignJob.status, 404);

  const foreignCancel = await userB.post('/api/jobs/' + jobId + '/cancel');
  assert.equal(foreignCancel.status, 404);
});
