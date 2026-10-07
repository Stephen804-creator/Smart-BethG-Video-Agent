import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import request from 'supertest';
import { createUser, getUserByEmail, getUserById, getDatabaseStatus } from '../server/database.js';
import { assertSafeComfyUrl } from '../server/security/outbound.js';

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
  const jobResponse = await api.get('/api/jobs/nonexistent');
  assert.equal(jobResponse.status, 401);
});

test('registration, login, status and logout work through session cookies', { skip: !enabled }, async () => {
  const suffix = Date.now();
  const email = `auth-${suffix}@example.test`;
  const password = 'correct-horse-battery-3';
  const agent = request.agent('http://127.0.0.1:8787');

  const registered = await agent.post('/api/auth/register').send({ email, password, displayName: 'Auth Test' });
  assert.equal(registered.status, 201);
  assert.equal(registered.body.authenticated, true);
  assert.match(registered.headers['set-cookie']?.join(';') || '', /session=/);

  const status = await agent.get('/api/auth/status');
  assert.equal(status.status, 200);
  assert.equal(status.body.authenticated, true);
  assert.equal(status.body.user.email, email);

  const loggedOut = await agent.post('/api/auth/logout');
  assert.equal(loggedOut.status, 200);

  const afterLogout = await agent.get('/api/auth/status');
  assert.equal(afterLogout.body.authenticated, false);

  const login = await agent.post('/api/auth/login').send({ email, password });
  assert.equal(login.status, 200);
  assert.equal(login.body.authenticated, true);
});

test('invalid login is rejected without authenticating the session', { skip: !enabled }, async () => {
  const suffix = Date.now();
  const email = `invalid-login-${suffix}@example.test`;
  const agent = request.agent('http://127.0.0.1:8787');
  await agent.post('/api/auth/register').send({ email, password: 'correct-horse-battery-4' });
  await agent.post('/api/auth/logout');

  const response = await agent.post('/api/auth/login').send({ email, password: 'wrong-password' });
  assert.equal(response.status, 401);
  const status = await agent.get('/api/auth/status');
  assert.equal(status.body.authenticated, false);
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
  assert.equal(ownProject.status, 200, JSON.stringify(ownProject.body));

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

test('database user records round-trip and remain queryable by owner identity', { skip: !enabled }, async () => {
  const suffix = Date.now();
  const email = `db-${suffix}@example.test`;
  const created = await createUser({ email, passwordHash: 'test-hash', displayName: 'DB Test' });
  const byEmail = await getUserByEmail(email);
  const byId = await getUserById(created.id);
  assert.equal(byEmail.id, created.id);
  assert.equal(byId.email, email);
  assert.equal(byId.display_name, 'DB Test');

  const database = await getDatabaseStatus();
  assert.equal(database.enabled, true);
  assert.equal(database.connected, true);
});

test('outbound URL guard blocks internal endpoints and embedded credentials', { skip: !enabled }, async () => {
  await assert.rejects(() => assertSafeComfyUrl('http://127.0.0.1:8188'), /private or internal network/);
  await assert.rejects(() => assertSafeComfyUrl('http://localhost:8188'), /blocked internal hostname/);
  await assert.rejects(() => assertSafeComfyUrl('https://user:password@example.com'), /embedded credentials/);
});
