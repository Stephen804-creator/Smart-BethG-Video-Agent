import { test, expect } from '@playwright/test';

test('login → generate → export production flow', async ({ page }) => {
  const suffix = Date.now();
  const email = `e2e-${suffix}@example.test`;
  const password = 'correct-horse-battery-9';

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
    body: 'event: job\ndata: {"id":"e2e-job-1","status":"completed","result":{"generation":{"id":"e2e-generation","output":"/output/e2e.mp4","provider":"test"}}}\n\n'
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
  await expect(page.getByText('Sign in to access your production workspace.')).toBeVisible();
  await page.getByRole('button', { name: /Create a new account/i }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password (8+ characters)').fill(password);
  await page.getByRole('button', { name: /Create account/i }).click();
  await expect(page.getByText('Generate a shot')).toBeVisible();

  const project = await page.context().request.post('http://127.0.0.1:5173/api/film/projects', {
    data: { title: 'E2E Film' }
  });
  expect(project.ok()).toBeTruthy();

  await page.reload();
  await expect(page.getByPlaceholder('Describe the shot you want to generate…')).toBeVisible();
  await page.getByPlaceholder('Describe the shot you want to generate…').fill('A cinematic test shot');
  await page.getByRole('button', { name: /Generate cinematic shot/i }).click();
  await expect(page.getByText('Completed')).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /Export/i }).first().click();
  await expect(page.getByText('Film export ready')).toBeVisible();
});
