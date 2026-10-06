import { Router } from 'express';
import { asyncRoute, HttpError, notFoundError, requireUser, sendData, validationError } from './http.js';
import { validateIntake, validateListQuery, parseTimestamp } from './validation.js';
import { changeBlotterStatus, createBlotter, getBlotter, getOverview, listBlotters, listEvents } from './services/blotters.js';
import {
  approveResidentReport, createPublicReport, getBarangayBySlug, getBarangayPublic,
  getResidentReport, listResidentReports, rejectResidentReport
} from './services/resident-reports.js';
import { CATEGORIES, CATEGORY_VALUES, STATUS_VALUES } from './constants.js';
import { createIpRateLimiter } from './rate-limit.js';
import { authRouter } from './routes/auth.js';

function routeId(value) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function unknownFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { body: 'Must be a JSON object' };
  const fields = {};
  for (const key of Object.keys(body)) if (!allowed.has(key)) fields[key] = 'Unknown field';
  return fields;
}

function validatePublicReport(body) {
  const fields = unknownFields(body, new Set(['reporter_name', 'reporter_contact', 'incident_type', 'incident_datetime', 'sitio', 'landmark', 'respondent_name', 'narrative', 'website']));
  if (fields.body) return { ok: false, fields };
  for (const name of ['reporter_name', 'incident_type', 'incident_datetime', 'sitio', 'narrative']) if (!Object.hasOwn(body, name)) fields[name] = 'Required';
  const value = {};
  const text = (name, max, required = false) => {
    let current = body[name];
    if (current === undefined || current === null || (typeof current === 'string' && current.trim() === '')) current = null;
    else if (typeof current === 'string') current = current.trim();
    else { fields[name] = 'Must be text'; return null; }
    if (current === null && required) fields[name] = 'Required';
    if (current !== null && current.length > max) fields[name] = `Must be at most ${max} characters`;
    return current;
  };
  value.reporter_name = text('reporter_name', 160, true);
  value.reporter_contact = text('reporter_contact', 20);
  if (value.reporter_contact !== null && (!/^[0-9 +()\-]{7,20}$/.test(value.reporter_contact) || value.reporter_contact.replace(/\D/g, '').length < 7)) fields.reporter_contact = 'Enter a valid contact';
  if (!CATEGORY_VALUES.has(body.incident_type)) fields.incident_type = 'Choose a valid incident type';
  else value.incident_type = body.incident_type;
  const parsedTimestamp = parseTimestamp(body.incident_datetime);
  if (!parsedTimestamp) fields.incident_datetime = 'Must be a valid timestamp with explicit offset, no later than now';
  else value.incident_datetime = parsedTimestamp;
  value.sitio = text('sitio', 120, true);
  value.landmark = text('landmark', 255);
  value.respondent_name = text('respondent_name', 160);
  value.narrative = text('narrative', 5000, true);
  value.website = text('website', 255);
  if (Object.keys(fields).length) return { ok: false, fields };
  if (value.website) return { ok: false, honeypot: true };
  delete value.website;
  return { ok: true, value };
}

export function apiRouter({ pool, appUrl, loginLimiter = createIpRateLimiter({ limit: 10 }), publicLimiter = createIpRateLimiter({ limit: 5 }) }) {
  const router = Router();
  router.use('/auth', authRouter({ pool, appUrl, loginLimiter }));
  router.use('/blotters', requireUser);
  router.post('/blotters', asyncRoute(async (req, res) => {
    const checked = validateIntake(req.body);
    if (!checked.ok) throw validationError(checked.fields);
    const tenant = { barangay_id: req.session.user.barangay_id, barangay_code: req.session.user.barangay_code, city_id: req.session.user.city_id };
    sendData(res, await createBlotter(pool, { intake: checked.value, tenant, actorId: req.session.user.id }), 201);
  }));
  router.get('/blotters', asyncRoute(async (req, res) => {
    const checked = validateListQuery(req.query);
    if (!checked.ok) throw validationError(checked.fields);
    const result = await listBlotters(pool, req.session.user.barangay_id, req.query, checked);
    res.json(result);
  }));
  router.get('/blotters/:id/events', asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    if (!id) throw validationError({ id: 'Must be a positive integer' });
    if (!await getBlotter(pool, id, req.session.user.barangay_id)) throw notFoundError();
    sendData(res, await listEvents(pool, id, req.session.user.barangay_id));
  }));
  router.get('/blotters/:id', asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    if (!id) throw validationError({ id: 'Must be a positive integer' });
    const blotter = await getBlotter(pool, id, req.session.user.barangay_id);
    if (!blotter) throw notFoundError();
    sendData(res, blotter);
  }));
  router.patch('/blotters/:id/status', asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    if (!id) throw validationError({ id: 'Must be a positive integer' });
    const fields = unknownFields(req.body, new Set(['status', 'expected_version', 'reason']));
    if (!Object.hasOwn(req.body || {}, 'status')) fields.status = 'Required';
    if (!Object.hasOwn(req.body || {}, 'expected_version')) fields.expected_version = 'Required';
    if (req.body?.status !== undefined && !STATUS_VALUES.has(req.body.status)) fields.status = 'Choose a valid status';
    if (!Number.isSafeInteger(req.body?.expected_version) || req.body.expected_version < 1) fields.expected_version = 'Must be a positive integer';
    if (req.body?.reason !== undefined && (typeof req.body.reason !== 'string' || req.body.reason.trim().length > 1000)) fields.reason = 'Must be at most 1000 characters';
    if (Object.keys(fields).length) throw validationError(fields);
    const updated = await changeBlotterStatus(pool, { id, tenantId: req.session.user.barangay_id, actorId: req.session.user.id, status: req.body.status, expectedVersion: req.body.expected_version, reason: req.body.reason });
    sendData(res, updated);
  }));
  router.get('/overview', requireUser, asyncRoute(async (req, res) => sendData(res, await getOverview(pool, req.session.user.barangay_id))));

  router.get('/public/barangays/:slug', asyncRoute(async (req, res) => {
    const barangay = await getBarangayPublic(pool, req.params.slug, appUrl);
    if (!barangay) throw notFoundError();
    sendData(res, { ...barangay, incident_categories: CATEGORIES.map(([value, label]) => ({ value, label })) });
  }));
  router.post('/public/barangays/:slug/reports', publicLimiter, asyncRoute(async (req, res) => {
    const checked = validatePublicReport(req.body);
    if (!checked.ok) {
      if (checked.honeypot) throw new HttpError(422, 'VALIDATION_ERROR', 'Check the marked fields.');
      throw validationError(checked.fields);
    }
    const barangay = await getBarangayBySlug(pool, req.params.slug);
    if (!barangay) throw notFoundError();
    const report = await createPublicReport(pool, { barangay, values: checked.value });
    sendData(res, { reference: report.reference, status: report.status, submitted_at: report.submitted_at }, 201);
  }));

  router.use('/resident-reports', requireUser);
  router.get('/resident-reports', asyncRoute(async (req, res) => {
    const checked = validateListQuery(req.query, { reports: true });
    if (!checked.ok) throw validationError(checked.fields);
    res.json(await listResidentReports(pool, req.session.user.barangay_id, req.query, checked));
  }));
  router.get('/resident-reports/:id', asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    if (!id) throw validationError({ id: 'Must be a positive integer' });
    const report = await getResidentReport(pool, id, req.session.user.barangay_id);
    if (!report) throw notFoundError();
    sendData(res, report);
  }));
  router.post('/resident-reports/:id/approve', asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    if (!id) throw validationError({ id: 'Must be a positive integer' });
    const fields = unknownFields(req.body, new Set(['intake']));
    if (!Object.hasOwn(req.body || {}, 'intake')) fields.intake = 'Required';
    if (Object.keys(fields).length) throw validationError(fields);
    const checked = validateIntake(req.body.intake, { allowDraft: false });
    if (!checked.ok) throw validationError(checked.fields);
    const tenant = { barangay_id: req.session.user.barangay_id, barangay_code: req.session.user.barangay_code, city_id: req.session.user.city_id };
    const result = await approveResidentReport(pool, { id, tenant, actorId: req.session.user.id, intake: checked.value });
    sendData(res, { report: result.report, blotter: result.blotter }, result.repeated ? 200 : 201);
  }));
  router.post('/resident-reports/:id/reject', asyncRoute(async (req, res) => {
    const id = routeId(req.params.id);
    if (!id) throw validationError({ id: 'Must be a positive integer' });
    const fields = unknownFields(req.body, new Set(['reason']));
    if (!Object.hasOwn(req.body || {}, 'reason')) fields.reason = 'Required';
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (reason.length < 1 || reason.length > 1000) fields.reason = 'Must contain 1–1000 characters';
    if (Object.keys(fields).length) throw validationError(fields);
    sendData(res, await rejectResidentReport(pool, { id, tenantId: req.session.user.barangay_id, actorId: req.session.user.id, reason }));
  }));
  return router;
}

export { validatePublicReport };
