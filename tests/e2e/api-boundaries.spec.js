import { test, expect, origin } from './fixtures.js';

const validIntake = (name = `Synthetic Boundary ${Date.now()}`) => ({
  incident_type: 'property_dispute',
  incident_datetime: new Date(Date.now() - 86_400_000).toISOString(),
  sitio: 'Synthetic Purok',
  landmark: null,
  complainant_name: name,
  complainant_contact: null,
  complainant_sitio: null,
  complainant_resident_status: 'unknown',
  respondent_unknown: true,
  respondent_name: null,
  respondent_contact: null,
  respondent_sitio: null,
  respondent_resident_status: 'unknown',
  narrative: 'Synthetic API boundary verification only.',
  status: 'pending_lupon',
});

test('staff writes reject missing CSRF, spoofed identity, and invalid intake', async ({ authenticatedRequest }) => {
  const { context, token } = authenticatedRequest;
  const body = validIntake();
  const missingToken = await context.post('/api/blotters', { headers: { Origin: origin }, data: body });
  expect(missingToken.status()).toBe(403);
  const spoofed = await context.post('/api/blotters', {
    headers: { Origin: origin, 'X-CSRF-Token': token },
    data: { ...body, barangay_id: 999, created_by: 999 },
  });
  expect(spoofed.status()).toBe(422);
  const invalid = await context.post('/api/blotters', {
    headers: { Origin: origin, 'X-CSRF-Token': token },
    data: { ...body, complainant_name: '', sitio: '', narrative: '' },
  });
  expect(invalid.status()).toBe(422);
  const error = await invalid.json();
  expect(error.error.fields).toHaveProperty('sitio');
  const results = await context.get(`/api/blotters?q=${encodeURIComponent(body.complainant_name)}`);
  expect((await results.json()).data).toHaveLength(0);
});

test('literal percent search matches exact records and bad query keys cannot broaden the tenant list', async ({ authenticatedRequest }) => {
  const { context, token } = authenticatedRequest;
  const prefix = `Synthetic API LiteralPercent ${Date.now()} ${Math.random().toString(36).slice(2)}`;
  const expectedIds = [];
  for (const suffix of ['first', 'second']) {
    const created = await context.post('/api/blotters', {
      headers: { Origin: origin, 'X-CSRF-Token': token },
      data: validIntake(`${prefix}% ${suffix}`),
    });
    expect(created.status()).toBe(201);
    expectedIds.push((await created.json()).data.id);
  }
  const similar = await context.post('/api/blotters', {
    headers: { Origin: origin, 'X-CSRF-Token': token },
    data: validIntake(`${prefix}X first`),
  });
  expect(similar.status()).toBe(201);
  const similarId = (await similar.json()).data.id;

  const firstPage = await context.get(`/api/blotters?q=${encodeURIComponent(`${prefix}%`)}&page=1&page_size=1`);
  expect(firstPage.status()).toBe(200);
  const firstBody = await firstPage.json();
  expect(firstBody.data).toHaveLength(1);
  expect(firstBody.meta).toMatchObject({ page: 1, page_size: 1, total: 2, total_pages: 2 });
  const secondPage = await context.get(`/api/blotters?q=${encodeURIComponent(`${prefix}%`)}&page=2&page_size=1`);
  expect(secondPage.status()).toBe(200);
  const secondBody = await secondPage.json();
  expect(secondBody.data).toHaveLength(1);
  expect(secondBody.meta).toMatchObject({ page: 2, page_size: 1, total: 2, total_pages: 2 });
  const actualIds = [firstBody.data[0].id, secondBody.data[0].id];
  expect(new Set(actualIds)).toEqual(new Set(expectedIds));
  expect(actualIds).not.toContain(similarId);

  expect((await context.get('/api/blotters?page_size=101')).status()).toBe(422);
  expect((await context.get('/api/blotters?barangay_id=999')).status()).toBe(422);
  expect((await context.get('/api/blotters?date_from=2026-02-30')).status()).toBe(422);
});

test('anonymous metadata and unknown routes expose no case details', async ({ playwright }) => {
  const context = await playwright.request.newContext({ baseURL: origin });
  try {
    expect((await context.get('/api/blotters')).status()).toBe(401);
    const metadata = await context.get('/api/public/barangays/demo-a');
    expect(metadata.status()).toBe(200);
    const { data } = await metadata.json();
    expect(data.report_url).toContain('/report/demo-a');
    expect(data).not.toHaveProperty('users');
    expect(data).not.toHaveProperty('narrative');
    expect(data).not.toHaveProperty('complainant_contact');
    const missing = await context.get('/api/not-an-endpoint');
    expect(missing.status()).toBe(404);
    expect((await missing.json()).error.code).toBe('NOT_FOUND');
  } finally {
    await context.dispose();
  }
});
