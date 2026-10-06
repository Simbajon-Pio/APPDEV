import { test, expect } from '@playwright/test';

const password = process.env.DEMO_PASSWORD || 'DemoOnly!2026';

function manilaWallTime() {
  return new Date(Date.now() - 3_600_000 + 8 * 3_600_000).toISOString().slice(0, 16);
}

async function staffLogin(page) {
  await page.goto('/login');
  await page.getByLabel(/username/i).fill('demo_a');
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('staff creates a persisted official record through the intake screen', async ({ page }) => {
  const name = `Synthetic UI ${Date.now()}`;
  await staffLogin(page);
  await page.goto('/blotters/new');
  await page.locator('#incident_type').selectOption('noise_disturbance');
  await page.locator('#incident_datetime').fill(manilaWallTime());
  await page.locator('#sitio').fill('Synthetic Purok');
  await page.locator('#complainant_name').fill(name);
  await page.locator('#narrative').fill('Synthetic browser acceptance record; no genuine resident details.');
  await page.getByRole('button', { name: /^save record$/i }).click();
  await expect(page.getByRole('heading', { name: /^BLOT-/ })).toBeVisible();
  const caseNumber = await page.getByRole('heading', { name: /^BLOT-/ }).innerText();
  await page.getByRole('button', { name: /view record/i }).click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(caseNumber, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
});

test('resident submits through a phone-width form and receives a genuine receipt', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 850 });
  await page.goto('/report/demo-a');
  await page.locator('#reporter_name').fill(`Synthetic Browser Resident ${Date.now()}`);
  await page.locator('#incident_type').selectOption('property_dispute');
  await page.locator('#incident_datetime').fill(manilaWallTime());
  await page.locator('#sitio').fill('Synthetic Purok');
  await page.locator('#narrative').fill('Synthetic public-report browser acceptance test only.');
  await page.getByRole('button', { name: /submit report|send report/i }).click();
  await expect(page.getByText(/RPT-[A-Za-z0-9-]+/).first()).toBeVisible();
  const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
});
