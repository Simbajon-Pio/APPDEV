import { test, expect, origin } from './fixtures.js';

const password = process.env.DEMO_PASSWORD || 'DemoOnly!2026';

async function authenticate(request, username) {
  const bootstrap = await request.get('/api/auth/csrf');
  expect(bootstrap.status()).toBe(200);
  const { data: initial } = await bootstrap.json();
  const login = await request.post('/api/auth/login', {
    headers: { Origin: origin, 'X-CSRF-Token': initial.csrf_token },
    data: { username, password },
  });
  expect(login.status()).toBe(200);
  const { data } = await login.json();
  return { token: data.csrf_token, user: data.user };
}

function intake(overrides = {}) {
  return {
    incident_type: 'noise_disturbance',
    incident_datetime: new Date(Date.now() - 3_600_000).toISOString(),
    sitio: 'Demo Purok 1',
    landmark: null,
    complainant_name: `Synthetic E2E ${Date.now()}`,
    complainant_contact: null,
    complainant_sitio: null,
    complainant_resident_status: 'unknown',
    respondent_unknown: true,
    respondent_name: null,
    respondent_contact: null,
    respondent_sitio: null,
    respondent_resident_status: 'unknown',
    narrative: 'Synthetic automated-test report; no genuine resident details.',
    status: 'pending_lupon',
    ...overrides,
  };
}

const mutationHeaders = (token) => ({ Origin: origin, 'X-CSRF-Token': token });

test('real MySQL workflow preserves drafts, audit metadata, and exactly-once resident approval', async ({ authenticatedRequest }) => {
  const { context, token } = authenticatedRequest;
  const draftBody = intake({ status: 'draft' });
  const created = await context.post('/api/blotters', { headers: mutationHeaders(token), data: draftBody });
  expect(created.status()).toBe(201);
  const { data: draft } = await created.json();
  expect(draft.case_id).toMatch(/^BLOT-[A-Z0-9]+-\d{4}-\d{5,}$/);
  expect(draft.submitted_at).toBeNull();

  const active = await context.get(`/api/blotters?q=${encodeURIComponent(draft.case_id)}`);
  expect((await active.json()).data).toHaveLength(0);
  const filtered = await context.get(`/api/blotters?status=draft&q=${encodeURIComponent(draft.case_id)}`);
  expect((await filtered.json()).data[0].id).toBe(draft.id);

  const submitted = await context.patch(`/api/blotters/${draft.id}/status`, {
    headers: mutationHeaders(token), data: { status: 'pending_lupon', expected_version: draft.version },
  });
  expect(submitted.status()).toBe(200);
  const { data: official } = await submitted.json();
  expect(official.case_id).toBe(draft.case_id);
  expect(official.created_at).toBe(draft.created_at);
  expect(official.created_by).toBe(draft.created_by);
  expect(official.submitted_at).not.toBeNull();

  const stale = await context.patch(`/api/blotters/${draft.id}/status`, {
    headers: mutationHeaders(token), data: { status: 'settled_at_desk', expected_version: draft.version },
  });
  expect(stale.status()).toBe(409);

  const resident = await context.post('/api/public/barangays/demo-a/reports', {
    headers: { Origin: origin },
    data: {
      reporter_name: `Synthetic Resident ${Date.now()}`,
      reporter_contact: null,
      incident_type: draftBody.incident_type,
      incident_datetime: draftBody.incident_datetime,
      sitio: draftBody.sitio,
      landmark: null,
      respondent_name: null,
      narrative: draftBody.narrative,
      website: '',
    },
  });
  expect(resident.status()).toBe(201);
  const { data: acknowledgement } = await resident.json();
  expect(acknowledgement.reference).toMatch(/^RPT-/);
  expect(acknowledgement).not.toHaveProperty('reporter_name');

  const queue = await context.get(`/api/resident-reports?q=${encodeURIComponent(acknowledgement.reference)}`);
  const report = (await queue.json()).data[0];
  expect(report.status).toBe('pending_review');
  const approvals = await Promise.all([0, 1].map(() => context.post(`/api/resident-reports/${report.id}/approve`, {
    headers: mutationHeaders(token), data: { intake: intake({ complainant_name: 'Confirmed Synthetic Reporter' }) },
  })));
  expect(approvals.map((response) => response.status()).sort()).toEqual([200, 201]);
  const outcomes = await Promise.all(approvals.map((response) => response.json()));
  expect(outcomes[0].data.blotter.id).toBe(outcomes[1].data.blotter.id);
  const reviewed = await context.get(`/api/resident-reports/${report.id}`);
  const { data: persisted } = await reviewed.json();
  expect(persisted.original.reporter_name).not.toBe('Confirmed Synthetic Reporter');
  expect(persisted.status).toBe('approved');
});

test('a second tenant cannot read or update another tenant case', async ({ authenticatedRequest, playwright }) => {
  const { context: a, token: tokenA } = authenticatedRequest;
  const b = await playwright.request.newContext({ baseURL: origin });
  try {
    const created = await a.post('/api/blotters', { headers: mutationHeaders(tokenA), data: intake() });
    expect(created.status()).toBe(201);
    const { data: caseA } = await created.json();
    const authB = await authenticate(b, 'demo_b');
    for (const route of [`/api/blotters/${caseA.id}`, `/api/blotters/${caseA.id}/events`]) {
      expect((await b.get(route)).status()).toBe(404);
    }
    const attempt = await b.patch(`/api/blotters/${caseA.id}/status`, {
      headers: mutationHeaders(authB.token), data: { status: 'settled_at_desk', expected_version: caseA.version },
    });
    expect(attempt.status()).toBe(404);
    const search = await b.get(`/api/blotters?q=${encodeURIComponent(caseA.case_id)}`);
    expect((await search.json()).data).toHaveLength(0);
  } finally {
    await b.dispose();
  }
});

test('staff workspace signs in and renders without horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 850 });
  await page.goto('/login');
  await page.getByLabel(/username/i).fill('demo_a');
  await page.getByLabel(/^password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
});

test('resident form is accessible directly without staff sign-in', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 850 });
  await page.goto('/report/demo-a');
  await expect(page.getByLabel(/full name|your name|reporter name/i).first()).toBeVisible();
  await expect(page.getByText(/not.*emergency|emergency.*channel/i).first()).toBeVisible();
  expect(page.url()).not.toContain('/login');
});
