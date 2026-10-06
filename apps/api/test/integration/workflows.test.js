import test from 'node:test';
import assert from 'node:assert/strict';
import { setMaxListeners } from 'node:events';
import request from 'supertest';
import { createPool } from 'mysql2/promise';
import { createApp } from '../../src/app.js';
import { createBlotter } from '../../src/services/blotters.js';

const testDatabase = process.env.TEST_DB_NAME;
if (!testDatabase || !/_test$/i.test(testDatabase)) throw new Error('TEST_DB_NAME must explicitly name an isolated database ending in _test.');
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.TEST_DB_HOST || '127.0.0.1')) throw new Error('TEST_DB_HOST must be loopback; shared or remote databases are forbidden.');
setMaxListeners(30);
if (process.env.DB_NAME && process.env.DB_NAME !== testDatabase) throw new Error('DB_NAME must match TEST_DB_NAME.');
if (process.env.DB_HOST && process.env.DB_HOST !== (process.env.TEST_DB_HOST || '127.0.0.1')) throw new Error('DB_HOST must match TEST_DB_HOST.');
process.env.DB_HOST = process.env.TEST_DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT || '3307';
process.env.DB_NAME = testDatabase;
process.env.DB_USER = process.env.TEST_DB_USER || 'ebarangaymo';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'local-demo-only';

const base = {
  incident_type: 'noise_disturbance', incident_datetime: '2025-10-05T16:30:00.000Z',
  sitio: 'Synthetic Purok 1', landmark: null, complainant_name: 'Synthetic Complainant',
  complainant_contact: null, complainant_sitio: null, complainant_resident_status: 'unknown',
  respondent_unknown: true, respondent_name: null, respondent_contact: null, respondent_sitio: null,
  respondent_resident_status: 'unknown', narrative: 'Synthetic integration test incident.', status: 'pending_lupon'
};
const origin = process.env.APP_ORIGIN || 'http://localhost:5173';
const credentials = {
  a: { username: 'demo_a', password: process.env.DEMO_PASSWORD || 'DemoOnly!2026' },
  b: { username: 'demo_b', password: process.env.DEMO_PASSWORD || 'DemoOnly!2026' }
};

async function signedIn(agent, username, password) {
  const csrf = await agent.get('/api/auth/csrf');
  if (csrf.status !== 200) throw new Error(`csrf bootstrap failed: ${csrf.status} ${JSON.stringify(csrf.body)}`);
  const login = await agent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.data.csrf_token).send({ username, password });
  if (login.status !== 200) throw new Error(`login ${username} failed: ${JSON.stringify(login.body)}`);
  return login.body.data.csrf_token;
}

test('MySQL-backed API isolates tenants and converts a public report exactly once', async (t) => {
  const pool = createPool({
    host: process.env.TEST_DB_HOST || '127.0.0.1', port: Number(process.env.TEST_DB_PORT || 3307),
    database: testDatabase, user: process.env.TEST_DB_USER || 'ebarangaymo',
    password: process.env.TEST_DB_PASSWORD || 'local-demo-only', connectionLimit: 16, timezone: 'Z', dateStrings: true
  });
  const app = createApp({ pool });
  setMaxListeners(30, app);
  t.after(async () => { await app.locals.sessionStore.close(); await pool.end(); });

  const tenantA = request.agent(app);
  const tenantB = request.agent(app);
  const unauthenticatedMe = await request(app).get('/api/auth/me');
  assert.equal(unauthenticatedMe.status, 401, JSON.stringify(unauthenticatedMe.body));
  const publicMetadata = await request(app).get('/api/public/barangays/demo-a');
  assert.equal(publicMetadata.status, 200, JSON.stringify(publicMetadata.body));
  assert.equal(publicMetadata.body.data.slug, 'demo-a');
  assert.equal(publicMetadata.body.data.city_name, 'Demo City A');
  const unknownAccountAgent = request.agent(app);
  const unknownAccountCsrf = await unknownAccountAgent.get('/api/auth/csrf');
  const unknownAccountLogin = await unknownAccountAgent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', unknownAccountCsrf.body.data.csrf_token).send({ username: 'synthetic_missing_user', password: 'wrong-password' });
  assert.equal(unknownAccountLogin.status, 401);
  const existingAccountAgent = request.agent(app);
  const existingAccountCsrf = await existingAccountAgent.get('/api/auth/csrf');
  const existingAccountLogin = await existingAccountAgent.post('/api/auth/login').set('Origin', origin).set('X-CSRF-Token', existingAccountCsrf.body.data.csrf_token).send({ username: 'demo_a', password: 'wrong-password' });
  assert.equal(existingAccountLogin.status, 401);
  assert.deepEqual(unknownAccountLogin.body, existingAccountLogin.body);

  const csrfA = await signedIn(tenantA, credentials.a.username, credentials.a.password);
  const csrfB = await signedIn(tenantB, credentials.b.username, credentials.b.password);
  const meA = await tenantA.get('/api/auth/me');
  assert.equal(meA.status, 200);
  assert.equal(Number.isSafeInteger(meA.body.data.user.id), true);
  const sessionCookie = meA.headers['set-cookie'].find((cookie) => cookie.startsWith('ebm.sid='))?.split(';')[0];
  assert.ok(sessionCookie);
  const restartedApp = createApp({ pool });
  setMaxListeners(30, restartedApp);
  const afterRestart = await request(restartedApp).get('/api/auth/me').set('Cookie', sessionCookie);
  assert.equal(afterRestart.status, 200, JSON.stringify(afterRestart.body));
  assert.equal(afterRestart.body.data.user.id, meA.body.data.user.id);
  await restartedApp.locals.sessionStore.close();
  const [[seededA]] = await pool.execute("SELECT b.id AS barangay_id, u.id AS user_id FROM barangays b JOIN users u ON u.barangay_id = b.id WHERE b.slug = 'demo-a' AND u.username = 'demo_a'");
  assert.equal(meA.body.data.user.barangay.id, Number(seededA.barangay_id));

  const created = await tenantA.post('/api/blotters').set('Origin', origin).set('X-CSRF-Token', csrfA).send(base);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.match(created.body.data.case_id, /^BLOT-DMA-\d{4}-\d{5}$/);
  assert.equal(created.body.data.created_by, meA.body.data.user.id);
  assert.equal((await tenantB.get(`/api/blotters/${created.body.data.id}`)).status, 404);
  assert.equal((await tenantB.get(`/api/blotters?q=${encodeURIComponent(created.body.data.case_id)}`)).body.meta.total, 0);

  const publicReport = await request(app).post('/api/public/barangays/demo-a/reports').set('Origin', origin).send({
    reporter_name: 'Synthetic Resident', reporter_contact: null, incident_type: 'property_dispute',
    incident_datetime: base.incident_datetime, sitio: 'Synthetic Purok 2', landmark: null,
    respondent_name: null, narrative: 'Synthetic resident report.', website: ''
  });
  assert.equal(publicReport.status, 201, JSON.stringify(publicReport.body));
  assert.match(publicReport.body.data.reference, /^RPT-/);
  assert.equal(Object.hasOwn(publicReport.body.data, 'reporter_name'), false);

  const queue = await tenantA.get('/api/resident-reports');
  const report = queue.body.data.find((item) => item.reference === publicReport.body.data.reference);
  assert.ok(report);
  const intake = { ...base, incident_type: 'property_dispute', incident_datetime: new Date('2025-10-05T16:30:00.000Z'), sitio: 'Synthetic Purok 2', narrative: 'Synthetic resident report.', landmark: null, status: 'pending_lupon', complainant_name: 'Synthetic Resident' };
  const alteredApproval = await tenantA.post(`/api/resident-reports/${report.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ intake: { ...intake, narrative: 'Silently replaced narrative.' } });
  assert.equal(alteredApproval.status, 422, JSON.stringify(alteredApproval.body));
  const inventedRespondent = await tenantA.post(`/api/resident-reports/${report.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ intake: { ...intake, respondent_unknown: false, respondent_name: 'Invented Person', respondent_contact: '123456789', respondent_sitio: 'Invented Home Purok', respondent_resident_status: 'resident' } });
  assert.equal(inventedRespondent.status, 422, JSON.stringify(inventedRespondent.body));
  const stillPendingAfterPartyConflict = await tenantA.get(`/api/resident-reports/${report.id}`);
  assert.equal(stillPendingAfterPartyConflict.body.data.status, 'pending_review');
  const addedUnreportedContact = await tenantA.post(`/api/resident-reports/${report.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ intake: { ...intake, complainant_contact: '123456789' } });
  assert.equal(addedUnreportedContact.status, 422, JSON.stringify(addedUnreportedContact.body));
  const addedUnreportedHome = await tenantA.post(`/api/resident-reports/${report.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ intake: { ...intake, complainant_sitio: 'Invented Home Purok' } });
  assert.equal(addedUnreportedHome.status, 422, JSON.stringify(addedUnreportedHome.body));
  const addedUnreportedResidency = await tenantA.post(`/api/resident-reports/${report.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ intake: { ...intake, complainant_resident_status: 'resident' } });
  assert.equal(addedUnreportedResidency.status, 422, JSON.stringify(addedUnreportedResidency.body));
  const stillPending = await tenantA.get(`/api/resident-reports/${report.id}`);
  assert.equal(stillPending.body.data.status, 'pending_review');
  assert.equal(stillPending.body.data.original.narrative, 'Synthetic resident report.');
  const approval = await tenantA.post(`/api/resident-reports/${report.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ intake });
  assert.equal(approval.status, 201, JSON.stringify(approval.body));
  assert.equal(approval.body.data.report.status, 'approved');
  const repeated = await tenantA.post(`/api/resident-reports/${report.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ intake: { ...intake, complainant_name: 'Ignored Retry' } });
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.data.blotter.id, approval.body.data.blotter.id);
  assert.equal(repeated.body.data.blotter.complainant_name, 'Synthetic Resident');

  const firstUpdate = await tenantA.patch(`/api/blotters/${created.body.data.id}/status`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ status: 'settled_at_desk', expected_version: 1 });
  assert.equal(firstUpdate.status, 200, JSON.stringify(firstUpdate.body));
  assert.equal(firstUpdate.body.data.created_at, created.body.data.created_at);
  const tenant = { barangay_id: Number(seededA.barangay_id), barangay_code: 'DMA', city_id: Number(meA.body.data.user.city.id) };
  const auditSnapshot = await pool.execute('SELECT COUNT(*) AS total FROM blotters WHERE barangay_id = ?', [tenant.barangay_id]);
  const beforeFailedCreation = Number(auditSnapshot[0][0].total);
  const intakeYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric' }).format(new Date()));
  const sequenceSnapshot = await pool.execute('SELECT sequence_value FROM case_sequences WHERE barangay_id = ? AND intake_year = ?', [tenant.barangay_id, intakeYear]);
  const sequenceBeforeFailure = Number(sequenceSnapshot[0][0]?.sequence_value || 0);
  let badActor;
  try {
    await createBlotter(pool, { intake: { ...base, narrative: 'Transaction rollback synthetic case.' }, tenant, actorId: 999999999 });
  } catch (error) {
    badActor = error;
  }
  assert.ok(badActor instanceof Error);
  const [afterFailedRows] = await pool.execute('SELECT COUNT(*) AS total FROM blotters WHERE barangay_id = ?', [tenant.barangay_id]);
  assert.equal(Number(afterFailedRows[0].total), beforeFailedCreation);
  const [sequenceAfterRows] = await pool.execute('SELECT sequence_value FROM case_sequences WHERE barangay_id = ? AND intake_year = ?', [tenant.barangay_id, intakeYear]);
  assert.equal(Number(sequenceAfterRows[0]?.sequence_value || 0), sequenceBeforeFailure);

  const stale = await tenantA.patch(`/api/blotters/${created.body.data.id}/status`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ status: 'referred_to_pnp', expected_version: 1 });
  assert.equal(stale.status, 409);
  const events = await tenantA.get(`/api/blotters/${created.body.data.id}/events`);
  assert.equal(events.status, 200);
  assert.equal(events.body.data.length, 2);
  assert.equal(events.body.data[1].from_status, 'pending_lupon');
  assert.equal(events.body.data[1].to_status, 'settled_at_desk');
  assert.equal(events.body.data[1].actor_id, created.body.data.created_by);
  const reportDay = '2025-10-06';
  const listedOnIncidentDay = await tenantA.get(`/api/blotters?date_from=${reportDay}&date_to=${reportDay}&q=${encodeURIComponent(created.body.data.case_id)}`);
  assert.equal(listedOnIncidentDay.body.meta.total, 1);
  const reopening = await tenantA.patch(`/api/blotters/${created.body.data.id}/status`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ status: 'pending_lupon', expected_version: 2, reason: 'Synthetic follow-up review.' });
  assert.equal(reopening.status, 200, JSON.stringify(reopening.body));
  const reopenedEvents = await tenantA.get(`/api/blotters/${created.body.data.id}/events`);
  assert.equal(reopenedEvents.body.data[2].reason, 'Synthetic follow-up review.');

  const parallelCreates = await Promise.all(Array.from({ length: 12 }, () => tenantA.post('/api/blotters').set('Origin', origin).set('X-CSRF-Token', csrfA).send(base)));
  for (const response of parallelCreates) assert.equal(response.status, 201, JSON.stringify(response.body));
  const caseIds = parallelCreates.map((response) => response.body.data.case_id);
  assert.equal(new Set(caseIds).size, caseIds.length);

  const draftResponse = await tenantA.post('/api/blotters').set('Origin', origin).set('X-CSRF-Token', csrfA).send({ ...base, status: 'draft' });
  assert.equal(draftResponse.status, 201, JSON.stringify(draftResponse.body));
  assert.equal(draftResponse.body.data.submitted_at, null);
  const activeBeforeDraftSubmit = await tenantA.get('/api/blotters');
  assert.equal(activeBeforeDraftSubmit.body.data.some((row) => row.id === draftResponse.body.data.id), false);
  const draftList = await tenantA.get('/api/blotters?status=draft');
  assert.equal(draftList.body.data.some((row) => row.id === draftResponse.body.data.id), true);
  const draftSubmission = await tenantA.patch(`/api/blotters/${draftResponse.body.data.id}/status`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ status: 'pending_lupon', expected_version: 1 });
  assert.equal(draftSubmission.status, 200, JSON.stringify(draftSubmission.body));
  assert.equal(draftSubmission.body.data.case_id, draftResponse.body.data.case_id);
  assert.equal(draftSubmission.body.data.created_at, draftResponse.body.data.created_at);
  assert.notEqual(draftSubmission.body.data.submitted_at, null);

  const tenantAReportId = report.id;
  assert.equal((await tenantB.get(`/api/resident-reports/${tenantAReportId}`)).status, 404);
  assert.equal((await tenantB.get('/api/resident-reports')).body.meta.total, 0);
  const forbiddenOrigin = await tenantA.patch(`/api/blotters/${created.body.data.id}/status`).set('Origin', 'https://attacker.invalid').set('X-CSRF-Token', csrfA).send({ status: 'pending_lupon', expected_version: 2, reason: 'Synthetic reason' });
  assert.equal(forbiddenOrigin.status, 403);
  const invalidSpoof = await tenantA.post('/api/blotters').set('Origin', origin).set('X-CSRF-Token', csrfA).send({ ...base, city_id: 9999 });
  assert.equal(invalidSpoof.status, 422);
  assert.equal((await tenantA.get('/api/blotters?page=1.5')).status, 422);
  assert.equal((await tenantA.get('/api/blotters?date_from=2025-02-30')).status, 422);

  const raceReportResponse = await request(app).post('/api/public/barangays/demo-a/reports').set('Origin', origin).send({
    reporter_name: 'Synthetic Race Resident', incident_type: 'others', incident_datetime: base.incident_datetime,
    sitio: 'Synthetic Purok 3', narrative: 'Synthetic concurrent approval test.', website: ''
  });
  assert.equal(raceReportResponse.status, 201, JSON.stringify(raceReportResponse.body));
  const raceQueue = await tenantA.get('/api/resident-reports');
  const raceReport = raceQueue.body.data.find((item) => item.reference === raceReportResponse.body.data.reference);
  const approvalBody = { intake: { ...base, incident_type: 'others', incident_datetime: new Date('2025-10-05T16:30:00.000Z'), sitio: 'Synthetic Purok 3', narrative: 'Synthetic concurrent approval test.', landmark: null, complainant_name: 'Synthetic Race Resident' } };
  const raceApprovals = await Promise.all([1, 2].map(() => tenantA.post(`/api/resident-reports/${raceReport.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send(approvalBody)));
  assert.deepEqual(raceApprovals.map((response) => response.status).sort(), [200, 201]);
  assert.equal(raceApprovals[0].body.data.blotter.id, raceApprovals[1].body.data.blotter.id);

  const rejectReportResponse = await request(app).post('/api/public/barangays/demo-a/reports').set('Origin', origin).send({
    reporter_name: 'Synthetic Rejection Resident', incident_type: 'curfew_violation', incident_datetime: base.incident_datetime,
    sitio: 'Synthetic Purok 4', narrative: 'Synthetic rejection test.', website: ''
  });
  assert.equal(rejectReportResponse.status, 201, JSON.stringify(rejectReportResponse.body));
  const rejectQueue = await tenantA.get('/api/resident-reports');
  const rejectReport = rejectQueue.body.data.find((item) => item.reference === rejectReportResponse.body.data.reference);
  const unconfirmedChange = await tenantA.post(`/api/resident-reports/${rejectReport.id}/approve`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ intake: { ...base, incident_type: 'others', incident_datetime: new Date('2025-10-05T16:30:00.000Z'), sitio: 'Synthetic Purok 4', narrative: 'Altered narrative.', complainant_name: 'Synthetic Rejection Resident' } });
  assert.equal(unconfirmedChange.status, 422);
  const rejection = await tenantA.post(`/api/resident-reports/${rejectReport.id}/reject`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ reason: 'Synthetic rejection reason' });
  assert.equal(rejection.status, 200, JSON.stringify(rejection.body));
  assert.equal(rejection.body.data.status, 'rejected');
  assert.equal(rejection.body.data.rejection_reason, 'Synthetic rejection reason');
  const repeatedRejection = await tenantA.post(`/api/resident-reports/${rejectReport.id}/reject`).set('Origin', origin).set('X-CSRF-Token', csrfA).send({ reason: 'Synthetic rejection reason' });
  assert.equal(repeatedRejection.status, 200);
  assert.equal(repeatedRejection.body.data.reviewed_at, rejection.body.data.reviewed_at);

  const noCsrf = await tenantA.patch(`/api/blotters/${created.body.data.id}/status`).set('Origin', origin).send({ status: 'pending_lupon', expected_version: 3, reason: 'Synthetic reopening reason' });
  assert.equal(noCsrf.status, 403);
  const overviewA = await tenantA.get('/api/overview');
  const overviewB = await tenantB.get('/api/overview');
  assert.equal(overviewA.status, 200);
  assert.equal(overviewB.status, 200);
  assert.notEqual(overviewA.body.data.total_blotters, overviewB.body.data.total_blotters);
  assert.equal(csrfB.length > 0, true);
});
