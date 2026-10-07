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

  const projectResponse = await api.post('/api/film/projects', {
    data: { title: 'E2E Film' }
  });
  expect(projectResponse.status()).toBe(201);
  const projectBody = await projectResponse.json();
  const projectId = projectBody.project.id;
  await api.post('/api/auth/logout');

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

  await page.route('**/api/generate', route => {
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

  await page.route('**/api/jobs/e2e-job-1/events', route => {
    jobEventsSeen = true;
    return route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: `event: job\ndata: {"id":"e2e-job-1","status":"completed","result":{"videoUrl":"/output/e2e.mp4","generation":{"id":"e2e-generation","output":"/output/e2e.mp4","provider":"test","model":"test-model","mode":"text-to-video","duration":4}}}\n\n`
    });
  });

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
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password (8+ characters)').fill(password);
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.status() === 200),
    page.getByRole('button', { name: 'Sign in', exact: true }).click()
  ]);

  await page.goto('/projects');
  await expect(page.getByText('Production dashboard')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Create / open production' }).click();
  await expect(page.locator('select').first()).toBeVisible({ timeout: 10_000 });
  await page.locator('select').first().selectOption(projectId);
  await expect(page.getByText('Generate a shot')).toBeVisible({ timeout: 10_000 });
  const shotPrompt = page.locator('textarea[placeholder*="Describe the shot you want"]').first();
  await expect(shotPrompt).toBeVisible({ timeout: 10_000 });
  await shotPrompt.fill('');
  await shotPrompt.pressSequentially('A cinematic test shot', { delay: 5 });
  await expect(shotPrompt).toHaveValue('A cinematic test shot');
  await page.waitForTimeout(500);
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  await page.getByRole('button', { name: /Generate cinematic shot/i }).click({ force: true });

  if (!generateRequestSeen) throw new Error(`Generate request was not sent. Page errors: ${consoleErrors.join(' | ')}`);
  await expect.poll(() => generateRequestSeen, { timeout: 10_000 }).toBe(true);
  await expect.poll(() => jobEventsSeen, { timeout: 10_000 }).toBe(true);

  await page.getByRole('button', { name: 'Export timeline' }).click();
  await expect.poll(() => exportRequestSeen, { timeout: 10_000 }).toBe(true);
  await expect(page.getByText('Film export ready')).toBeVisible();

  await api.dispose();
});
