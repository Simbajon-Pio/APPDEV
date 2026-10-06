import { test, expect } from '@playwright/test';

const origin = process.env.E2E_BASE_URL || 'http://localhost:5173';
const password = process.env.DEMO_PASSWORD || 'DemoOnly!2026';

async function signIn(request) {
  const bootstrap = await request.get('/api/auth/csrf');
  expect(bootstrap.status()).toBe(200);
  const { data: anonymous } = await bootstrap.json();
  const login = await request.post('/api/auth/login', {
    headers: { Origin: origin, 'X-CSRF-Token': anonymous.csrf_token },
    data: { username: 'demo_a', password },
  });
  expect(login.status()).toBe(200);
  return (await login.json()).data.csrf_token;
}

const validIntake = () => ({
  incident_type: 'property_dispute',
  incident_datetime: new Date(Date.now() - 86_400_000).toISOString(),
  sitio: 'Synthetic Purok',
  landmark: null,
  complainant_name: `Synthetic Boundary ${Date.now()}`,
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

test('staff writes reject missing CSRF, spoofed identity, and invalid intake', async ({ request }) => {
  const token = await signIn(request);
  const body = validIntake();
  const missingToken = await request.post('/api/blotters', { headers: { Origin: origin }, data: body });
  expect(missingToken.status()).toBe(403);
  const spoofed = await request.post('/api/blotters', {
    headers: { Origin: origin, 'X-CSRF-Token': token },
    data: { ...body, barangay_id: 999, created_by: 999 },
  });
  expect(spoofed.status()).toBe(422);
  const invalid = await request.post('/api/blotters', {
    headers: { Origin: origin, 'X-CSRF-Token': token },
    data: { ...body, complainant_name: '', sitio: '', narrative: '' },
  });
  expect(invalid.status()).toBe(422);
  const error = await invalid.json();
  expect(error.error.fields).toHaveProperty('sitio');
  const results = await request.get(`/api/blotters?q=${encodeURIComponent(body.complainant_name)}`);
  expect((await results.json()).data).toHaveLength(0);
});

test('literal wildcard search and bad query keys cannot broaden the tenant list', async ({ request }) => {
  await signIn(request);
  const wildcard = await request.get('/api/blotters?q=%25');
  expect(wildcard.status()).toBe(200);
  const result = await wildcard.json();
  expect(result.data.every((item) => [item.case_id, item.complainant_name, item.respondent_name || ''].some((text) => text.includes('%')))).toBe(true);
  expect((await request.get('/api/blotters?page_size=101')).status()).toBe(422);
  expect((await request.get('/api/blotters?barangay_id=999')).status()).toBe(422);
  expect((await request.get('/api/blotters?date_from=2026-02-30')).status()).toBe(422);
});

test('anonymous metadata and unknown routes expose no case details', async ({ request }) => {
  expect((await request.get('/api/blotters')).status()).toBe(401);
  const metadata = await request.get('/api/public/barangays/demo-a');
  expect(metadata.status()).toBe(200);
  const { data } = await metadata.json();
  expect(data.report_url).toContain('/report/demo-a');
  expect(data).not.toHaveProperty('users');
  expect(data).not.toHaveProperty('narrative');
  expect(data).not.toHaveProperty('complainant_contact');
  const missing = await request.get('/api/not-an-endpoint');
  expect(missing.status()).toBe(404);
  expect((await missing.json()).error.code).toBe('NOT_FOUND');
});
