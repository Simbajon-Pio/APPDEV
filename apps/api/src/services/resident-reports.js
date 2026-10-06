import { randomBytes } from 'node:crypto';
import { notFoundError, conflictError, validationError } from '../http.js';
import { escapeLike } from '../validation.js';
import { insertBlotter, getBlotter } from './blotters.js';

function iso(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return /Z$|[+-]\d\d:\d\d$/.test(text) ? new Date(text).toISOString() : `${text.replace(' ', 'T')}Z`;
}

export function serializeResidentReport(row) {
  if (!row) return null;
  return {
    id: Number(row.id), reference: row.reference, barangay_id: Number(row.barangay_id), city_id: Number(row.city_id), status: row.status,
    original: {
      reporter_name: row.reporter_name, reporter_contact: row.reporter_contact, incident_type: row.incident_type,
      incident_datetime: iso(row.incident_datetime), sitio: row.sitio, landmark: row.landmark,
      respondent_name: row.respondent_name, narrative: row.narrative
    },
    submitted_at: iso(row.submitted_at), reviewed_at: iso(row.reviewed_at),
    reviewed_by: row.reviewed_by === null ? null : Number(row.reviewed_by), reviewer_name: row.reviewer_name || null,
    rejection_reason: row.rejection_reason, blotter_id: row.blotter_id === null ? null : Number(row.blotter_id), case_id: row.case_id || null
  };
}

const REPORT_FIELDS = `r.id, r.reference, r.barangay_id, r.city_id, r.status, r.reporter_name, r.reporter_contact,
  r.incident_type, r.incident_datetime, r.sitio, r.landmark, r.respondent_name, r.narrative, r.submitted_at,
  r.reviewed_at, r.reviewed_by, reviewer.display_name AS reviewer_name, r.rejection_reason, r.blotter_id, b.case_id`;

async function fetchReport(connection, id, tenantId, { forUpdate = false } = {}) {
  const [rows] = await connection.execute(
    `SELECT ${REPORT_FIELDS} FROM resident_reports r LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
     LEFT JOIN blotters b ON b.id = r.blotter_id WHERE r.id = ? AND r.barangay_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [id, tenantId]
  );
  return rows[0] || null;
}

function makeReference() {
  return `RPT-${randomBytes(24).toString('base64url')}`;
}

export async function createPublicReport(pool, { barangay, values, now = new Date() }) {
  const reference = makeReference();
  const [result] = await pool.execute(
    `INSERT INTO resident_reports (reference, barangay_id, city_id, status, reporter_name, reporter_contact,
     incident_type, incident_datetime, sitio, landmark, respondent_name, narrative, submitted_at)
     VALUES (?, ?, ?, 'pending_review', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [reference, barangay.id, barangay.city_id, values.reporter_name, values.reporter_contact, values.incident_type,
      values.incident_datetime, values.sitio, values.landmark, values.respondent_name, values.narrative, now]
  );
  return { reference, status: 'pending_review', submitted_at: now.toISOString(), id: Number(result.insertId) };
}

export async function getBarangayPublic(pool, slug, appUrl) {
  const [rows] = await pool.execute('SELECT b.id, b.name, b.slug, b.city_id, c.name AS city_name FROM barangays b JOIN cities c ON c.id = b.city_id WHERE b.slug = ?', [slug]);
  if (!rows[0]) return null;
  return { id: Number(rows[0].id), name: rows[0].name, slug: rows[0].slug, city_name: rows[0].city_name, report_url: `${appUrl.replace(/\/$/, '')}/report/${encodeURIComponent(rows[0].slug)}` };
}

export async function getBarangayBySlug(pool, slug) {
  const [rows] = await pool.execute('SELECT b.id, b.city_id, b.name, b.slug, b.code, c.name AS city_name FROM barangays b JOIN cities c ON c.id = b.city_id WHERE b.slug = ?', [slug]);
  return rows[0] ? { ...rows[0], id: Number(rows[0].id), city_id: Number(rows[0].city_id) } : null;
}

export async function listResidentReports(pool, tenantId, query, pagination) {
  const where = ['r.barangay_id = ?'];
  const params = [tenantId];
  if (query.status !== undefined) { where.push('r.status = ?'); params.push(query.status); }
  else { where.push("r.status = 'pending_review'"); }
  if (query.q) {
    const like = `%${escapeLike(query.q)}%`;
    where.push('(r.reference LIKE ? OR r.reporter_name LIKE ?)');
    params.push(like, like);
  }
  const predicate = where.join(' AND ');
  const [[counts], [rows]] = await Promise.all([
    pool.execute(`SELECT COUNT(*) AS total FROM resident_reports r WHERE ${predicate}`, params),
    pool.execute(`SELECT ${REPORT_FIELDS} FROM resident_reports r LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by LEFT JOIN blotters b ON b.id = r.blotter_id WHERE ${predicate} ORDER BY r.submitted_at DESC, r.id DESC LIMIT ? OFFSET ?`, [...params, pagination.pageSize, (pagination.page - 1) * pagination.pageSize])
  ]);
  const total = Number(counts[0].total);
  return { data: rows.map(serializeResidentReport), meta: { page: pagination.page, page_size: pagination.pageSize, total, total_pages: Math.ceil(total / pagination.pageSize) } };
}

export async function getResidentReport(pool, id, tenantId) {
  const report = await fetchReport(pool, id, tenantId);
  return serializeResidentReport(report);
}

function equalTimestamp(left, right) {
  const toMillis = (value) => {
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(value)) return Date.parse(`${value.replace(' ', 'T')}Z`);
    if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?[+-]\d\d:\d\d$/.test(value)) return Date.parse(value);
    if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?Z$/.test(value)) return Date.parse(value);
    return Date.parse(value);
  };
  const leftTime = toMillis(left);
  const rightTime = toMillis(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

export function validateApprovalAgainstOriginal(report, intake) {
  const fields = {};
  const compare = (inputField, originalField, { required = false, normalize = (value) => value } = {}) => {
    const original = normalize(report[originalField]);
    const submitted = normalize(intake[inputField]);
    if (original === null || original === undefined || original === '') {
      if (required && submitted !== null && submitted !== undefined && submitted !== '') fields[inputField] = 'Cannot add a value that was not present in the resident submission';
      return;
    }
    if (submitted !== original) fields[inputField] = required ? 'Must match the original resident-submitted value' : 'Known resident-submitted value cannot be changed or omitted';
  };
  compare('incident_type', 'incident_type', { required: true });
  if (!equalTimestamp(report.incident_datetime, intake.incident_datetime)) fields.incident_datetime = 'Must match the original resident-submitted value';
  compare('sitio', 'sitio', { required: true, normalize: (value) => typeof value === 'string' ? value.trim() : value });
  compare('landmark', 'landmark', { required: true, normalize: (value) => value === '' ? null : value });
  compare('complainant_name', 'reporter_name', { required: true, normalize: (value) => typeof value === 'string' ? value.trim() : value });
  compare('complainant_contact', 'reporter_contact', { required: true, normalize: (value) => value === '' ? null : value });
  compare('complainant_sitio', 'reporter_sitio', { required: true, normalize: (value) => value === '' ? null : value });
  if (intake.complainant_resident_status !== 'unknown') fields.complainant_resident_status = 'Residency was not supplied and must remain unknown';
  compare('respondent_name', 'respondent_name', { required: true, normalize: (value) => value === '' ? null : value });
  compare('respondent_contact', 'respondent_contact', { required: true, normalize: (value) => value === '' ? null : value });
  compare('respondent_sitio', 'respondent_sitio', { required: true, normalize: (value) => value === '' ? null : value });
  if (intake.respondent_resident_status !== 'unknown') fields.respondent_resident_status = 'Respondent residency was not supplied and must remain unknown';
  if (report.respondent_name === null || report.respondent_name === undefined || report.respondent_name === '') {
    if (intake.respondent_unknown !== true) fields.respondent_name = 'Must remain unknown when no respondent was submitted';
  } else if (intake.respondent_unknown !== false) {
    fields.respondent_unknown = 'Must be false when a respondent was submitted';
  }
  compare('narrative', 'narrative', { required: true, normalize: (value) => typeof value === 'string' ? value.trim() : value });
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true };
}

export async function approveResidentReport(pool, { id, tenant, actorId, intake }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const report = await fetchReport(connection, id, tenant.barangay_id, { forUpdate: true });
    if (!report) throw notFoundError();
    if (report.status === 'approved') {
      const blotter = await getBlotter(connection, report.blotter_id, tenant.barangay_id);
      await connection.commit();
      return { report: serializeResidentReport(report), blotter, repeated: true };
    }
    if (report.status !== 'pending_review') throw conflictError('This report has already been reviewed.');
    const correspondence = validateApprovalAgainstOriginal(report, intake);
    if (!correspondence.ok) throw validationError(correspondence.fields, 'Confirmed intake must preserve known resident-submitted facts.');
    const now = new Date();
    const blotter = await insertBlotter(connection, { intake, tenant, actorId, source: 'resident_report', residentReportId: report.id, now });
    await connection.execute("UPDATE resident_reports SET status = 'approved', reviewed_at = ?, reviewed_by = ?, blotter_id = ? WHERE id = ? AND barangay_id = ? AND status = 'pending_review'", [now, actorId, blotter.id, report.id, tenant.barangay_id]);
    const updated = await fetchReport(connection, id, tenant.barangay_id);
    await connection.commit();
    return { report: serializeResidentReport(updated), blotter, repeated: false };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function rejectResidentReport(pool, { id, tenantId, actorId, reason }) {
  const normalized = reason.trim();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const report = await fetchReport(connection, id, tenantId, { forUpdate: true });
    if (!report) throw notFoundError();
    if (report.status === 'rejected') {
      if (report.rejection_reason !== normalized) throw conflictError('This report was rejected with a different reason.');
      await connection.commit();
      return serializeResidentReport(report);
    }
    if (report.status !== 'pending_review') throw conflictError('This report has already been reviewed.');
    const now = new Date();
    await connection.execute("UPDATE resident_reports SET status = 'rejected', rejection_reason = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ? AND barangay_id = ? AND status = 'pending_review'", [normalized, now, actorId, id, tenantId]);
    const updated = await fetchReport(connection, id, tenantId);
    await connection.commit();
    return serializeResidentReport(updated);
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
