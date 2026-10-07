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
  await api.post('/api/auth/logout');

  await page.route('**/api/providers*', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ providers: [{ id: 'huggingface-ltx', configured: true, health: { ok: true } }] })
  }));
  await page.route('**/api/generate', route => route.fulfill({
    status: 202, contentType: 'application/json',
    body: JSON.stringify({ status: 'Queued', job: { id: 'e2e-job-1', status: 'queued' } })
  }));
  await page.route('**/api/jobs/e2e-job-1/events', route => route.fulfill({
    status: 200,
    contentType: 'text/event-stream',
    body: `event: job\ndata: {"id":"e2e-job-1","status":"completed","result":{"generation":{"id":"e2e-generation","output":"/output/e2e.mp4","provider":"test"}}}\n\n`
  }));
  await page.route('**/api/jobs/e2e-job-1', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ job: { id: 'e2e-job-1', status: 'completed', result: { generation: { id: 'e2e-generation', output: '/output/e2e.mp4', provider: 'test' } } } })
  }));
  await page.route('**/api/jobs/e2e-job-1/cost', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ jobId: 'e2e-job-1', estimatedCostUsd: 0, actualCostUsd: 0, provider: 'test' })
  }));
  await page.route('**/api/film/projects/*/export', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ export: { output: '/output/e2e-export.mp4' } })
  }));

  await page.goto('/');
  await expect(page.getByPlaceholder('Email address')).toBeVisible();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password (8+ characters)').fill(password);
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.status() === 200),
    page.getByRole('button', { name: 'Sign in', exact: true }).click()
  ]);

  await expect(page.getByText('Generate a shot')).toBeVisible({ timeout: 10_000 });
  const projectResponse = await page.context().request.post('/api/film/projects', { data: { title: 'E2E Film' } });
  expect(projectResponse.ok()).toBeTruthy();
  await page.reload();
  await expect(page.getByText('Generate a shot')).toBeVisible({ timeout: 10_000 });
  const shotPrompt = page.locator('textarea[placeholder*="Describe the shot you want"]').first();
  await expect(shotPrompt).toBeVisible({ timeout: 10_000 });
  await shotPrompt.fill('A cinematic test shot');
  await page.getByRole('button', { name: /Generate cinematic shot/i }).click();
  await expect(page.getByText('No video returned')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Export timeline' }).click();
  await expect(page.getByText('Film export ready')).toBeVisible();
  await api.dispose();
});
