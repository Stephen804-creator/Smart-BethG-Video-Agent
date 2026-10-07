import { test, expect, request } from '@playwright/test';

test('login → generate → export production flow', async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-${suffix}@example.test`;
  const password = 'e2e-password';

  const api = await request.newContext({ baseURL: 'http://127.0.0.1:8787' });
  const registration = await api.post('/api/auth/register', {
    data: { email, password, displayName: 'E2E User' }
  });
  expect(registration.ok()).toBeTruthy();
  const projectResponse = await api.post('/api/film/projects', { data: { title: 'E2E Film' } });
  expect(projectResponse.status()).toBe(201);
  const projectBody = await projectResponse.json();
  const projectId = projectBody.project.id;

  let generateRequestSeen = false;
  let jobEventsSeen = false;
  let exportRequestSeen = false;
  page.on('request', request => {
    if (request.method() === 'POST' || request.url().includes('/api/generate')) console.log('E2E_REQUEST', request.method(), request.url());
  });
  page.on('console', message => console.log('BROWSER_CONSOLE', message.type(), message.text()));
  page.on('pageerror', error => console.log('BROWSER_PAGEERROR', error.message));

  await page.route('**/api/providers*', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      providers: [{ id: 'huggingface-ltx', configured: true, health: { ok: true } }]
    })
  }));

  await page.route('**generate*', route => {
    generateRequestSeen = true;
    return route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'Queued',
        job: { id: 'e2e-job-1', status: 'queued' }
      })
    });
  });

  await page.route('**/api/jobs/e2e-job-1/events', route => route.fulfill({
    status: 404,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'stream unavailable in fixture' })
  }));

  await page.route('**/api/jobs/e2e-job-1', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      job: {
        id: 'e2e-job-1',
        status: 'completed',
        result: {
          videoUrl: '/output/e2e.mp4',
          generation: {
            id: 'e2e-generation',
            output: '/output/e2e.mp4',
            provider: 'test',
            model: 'test-model',
            mode: 'text-to-video',
            duration: 4
          }
        }
      }
    })
  }));

  await page.route('**/api/jobs/e2e-job-1/cost', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      jobId: 'e2e-job-1',
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      provider: 'test'
    })
  }));

  await page.route('**/api/film/projects/*/export', route => {
    exportRequestSeen = true;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ export: { output: '/output/e2e-export.mp4' } })
    });
  });

  await page.goto('/');
  const loginResponse = await page.evaluate(async ({ email, password }) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return { status: response.status, body: await response.json() };
  }, { email, password });
  expect(loginResponse.status).toBe(200);
  await page.reload();

  await page.goto('/projects');
  await expect(page.getByText('Production dashboard')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Create / open production' }).click();
  const projectSelect = page.locator('.film-project-bar select');
  await expect(projectSelect).toBeVisible({ timeout: 10_000 });
  await expect(projectSelect.locator(`option[value="${projectId}"]`)).toHaveCount(1, { timeout: 10_000 });
  await projectSelect.selectOption(projectId);
  await expect(projectSelect).toHaveValue(projectId);
  await expect(page.getByText('Generate a shot')).toBeVisible({ timeout: 10_000 });
  const shotPrompt = page.locator('textarea[placeholder*="Describe the shot you want"]').first();
  await expect(shotPrompt).toBeVisible({ timeout: 10_000 });
  await shotPrompt.fill('');
  await shotPrompt.pressSequentially('A cinematic test shot', { delay: 5 });
  await expect(shotPrompt).toHaveValue('A cinematic test shot');
  await page.waitForTimeout(500);
  const generateResponse = await page.evaluate(async (projectId) => {
    const response = await fetch('/api/generate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'huggingface-ltx',
        prompt: 'A cinematic test shot',
        duration: 4,
        ratio: '16:9',
        framing: 'medium shot',
        cameraMovement: 'slow push-in',
        lighting: 'natural cinematic',
        projectId
      })
    });
    return { status: response.status, body: await response.json() };
  }, projectId);
  expect(generateResponse.status).toBe(202);
  await expect.poll(() => generateRequestSeen, { timeout: 10_000 }).toBe(true);
  await expect.poll(() => jobEventsSeen, { timeout: 10_000 }).toBe(true);

  await page.getByRole('button', { name: 'Export timeline' }).click();
  await expect.poll(() => exportRequestSeen, { timeout: 10_000 }).toBe(true);
  await expect(page.getByText('Film export ready')).toBeVisible();
  await api.dispose();
});
