import { test, expect, origin } from './fixtures.js';

const password = process.env.DEMO_PASSWORD || 'DemoOnly!2026';

async function authenticate(request) {
  const bootstrap = await request.get('/api/auth/csrf');
  expect(bootstrap.status()).toBe(200);
  const token = (await bootstrap.json()).data.csrf_token;
  const login = await request.post('/api/auth/login', {
    headers: { Origin: origin, 'X-CSRF-Token': token },
    data: { username: 'demo_a', password },
  });
  expect(login.status()).toBe(200);
  return (await login.json()).data.csrf_token;
}

function intake(name, date = new Date(Date.now() - 3_600_000).toISOString()) {
  return {
    incident_type: 'property_dispute', incident_datetime: date,
    sitio: 'Synthetic Boundary Purok', landmark: null,
    complainant_name: name, complainant_contact: null, complainant_sitio: null,
    complainant_resident_status: 'unknown', respondent_unknown: true,
    respondent_name: null, respondent_contact: null, respondent_sitio: null,
    respondent_resident_status: 'unknown', narrative: 'Synthetic transactional and date-boundary acceptance record.',
    status: 'pending_lupon',
  };
}

const headers = (token) => ({ Origin: origin, 'X-CSRF-Token': token });

test('parallel intake writes allocate distinct persisted case numbers and creation events', async ({ authenticatedRequest }) => {
  const { context, token } = authenticatedRequest;
  const prefix = `Synthetic Concurrent ${Date.now()}`;
  const responses = await Promise.all(Array.from({ length: 6 }, (_, index) =>
    context.post('/api/blotters', { headers: headers(token), data: intake(`${prefix} ${index}`) })));
  for (const response of responses) expect(response.status()).toBe(201);
  const cases = await Promise.all(responses.map(async (response) => (await response.json()).data));
  expect(new Set(cases.map((record) => record.case_id)).size).toBe(6);
  expect(new Set(cases.map((record) => record.id)).size).toBe(6);
  for (const record of cases) {
    const persisted = await context.get(`/api/blotters/${record.id}`);
    expect(persisted.status()).toBe(200);
    const detail = (await persisted.json()).data;
    expect(detail.case_id).toBe(record.case_id);
    expect(detail.created_by).toBe(record.created_by);
    const history = await context.get(`/api/blotters/${record.id}/events`);
    const events = (await history.json()).data;
    expect(events).toHaveLength(1);
    expect(events[0].actor_id).toBe(record.created_by);
    expect(events[0].to_status).toBe('pending_lupon');
  }
});

test('Philippine incident-day filtering includes midnight and excludes the next midnight', async ({ authenticatedRequest }) => {
  const { context, token } = authenticatedRequest;
  const name = `Synthetic ManilaBoundary ${Date.now()}`;
  const timestamps = ['2025-10-06T00:00:00+08:00', '2025-10-06T23:59:59+08:00', '2025-10-07T00:00:00+08:00'];
  const ids = [];
  for (const timestamp of timestamps) {
    const response = await context.post('/api/blotters', { headers: headers(token), data: intake(name, timestamp) });
    expect(response.status()).toBe(201);
    ids.push((await response.json()).data.id);
  }
  const response = await context.get(`/api/blotters?q=${encodeURIComponent(name)}&date_from=2025-10-06&date_to=2025-10-06`);
  expect(response.status()).toBe(200);
  const records = (await response.json()).data;
  expect(new Set(records.map((record) => record.id))).toEqual(new Set(ids.slice(0, 2)));
});

test('logout invalidates access and the old mutation token cannot be reused', async ({ request }) => {
  const token = await authenticate(request);
  const logout = await request.post('/api/auth/logout', { headers: headers(token), data: {} });
  expect(logout.status()).toBe(200);
  expect((await request.get('/api/auth/me')).status()).toBe(401);
  const attempted = await request.post('/api/blotters', { headers: headers(token), data: intake('Synthetic logged-out attempt') });
  expect(attempted.status()).toBe(401);
});
