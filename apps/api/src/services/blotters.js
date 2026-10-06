import { escapeLike } from '../validation.js';
import { conflictError, notFoundError } from '../http.js';

const BLOTTER_FIELDS = `b.id, b.case_id, b.barangay_id, b.city_id, b.created_by, creator.display_name AS creator_name,
  b.incident_type, b.incident_datetime, b.sitio, b.landmark, b.complainant_name, b.complainant_contact,
  b.complainant_sitio, b.complainant_resident_status, b.respondent_unknown, b.respondent_name,
  b.respondent_contact, b.respondent_sitio, b.respondent_resident_status, b.narrative, b.status, b.source,
  b.resident_report_id, b.created_at, b.submitted_at, b.updated_at, b.version`;

function iso(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value);
  return /Z$|[+-]\d\d:\d\d$/.test(text) ? new Date(text).toISOString() : `${text.replace(' ', 'T')}Z`;
}

export function serializeBlotter(row) {
  if (!row) return null;
  return {
    id: Number(row.id), case_id: row.case_id, barangay_id: Number(row.barangay_id), city_id: Number(row.city_id),
    created_by: Number(row.created_by), creator_name: row.creator_name, incident_type: row.incident_type,
    incident_datetime: iso(row.incident_datetime), sitio: row.sitio, landmark: row.landmark,
    complainant_name: row.complainant_name, complainant_contact: row.complainant_contact,
    complainant_sitio: row.complainant_sitio, complainant_resident_status: row.complainant_resident_status,
    respondent_unknown: Boolean(row.respondent_unknown), respondent_name: row.respondent_name,
    respondent_contact: row.respondent_contact, respondent_sitio: row.respondent_sitio,
    respondent_resident_status: row.respondent_resident_status, narrative: row.narrative, status: row.status,
    source: row.source, resident_report_id: row.resident_report_id === null ? null : Number(row.resident_report_id),
    created_at: iso(row.created_at), submitted_at: iso(row.submitted_at), updated_at: iso(row.updated_at), version: Number(row.version)
  };
}

export async function fetchBlotter(connection, { id, barangayId, forUpdate = false }) {
  const [rows] = await connection.execute(
    `SELECT ${BLOTTER_FIELDS} FROM blotters b JOIN users creator ON creator.id = b.created_by WHERE b.id = ? AND b.barangay_id = ?${forUpdate ? ' FOR UPDATE' : ''}`,
    [id, barangayId]
  );
  return rows[0] || null;
}

function manilaYear(date = new Date()) {
  return new Intl.DateTimeFormat('en', { timeZone: 'Asia/Manila', year: 'numeric' }).format(date);
}

async function allocateCaseId(connection, tenant, now) {
  const year = Number(manilaYear(now));
  await connection.execute(
    'INSERT INTO case_sequences (barangay_id, intake_year, sequence_value) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE sequence_value = sequence_value',
    [tenant.barangay_id, year]
  );
  const [rows] = await connection.execute('SELECT sequence_value FROM case_sequences WHERE barangay_id = ? AND intake_year = ? FOR UPDATE', [tenant.barangay_id, year]);
  const sequence = Number(rows[0].sequence_value) + 1;
  await connection.execute('UPDATE case_sequences SET sequence_value = ? WHERE barangay_id = ? AND intake_year = ?', [sequence, tenant.barangay_id, year]);
  return `BLOT-${tenant.barangay_code}-${year}-${String(sequence).padStart(5, '0')}`;
}

export async function insertBlotter(connection, { intake, tenant, actorId, source = 'walk_in', residentReportId = null, now = new Date() }) {
  const caseId = await allocateCaseId(connection, tenant, now);
  const submittedAt = intake.status === 'draft' ? null : now;
  const values = [
    caseId, tenant.barangay_id, tenant.city_id, actorId, intake.incident_type, intake.incident_datetime,
    intake.sitio, intake.landmark, intake.complainant_name, intake.complainant_contact, intake.complainant_sitio,
    intake.complainant_resident_status, intake.respondent_unknown ? 1 : 0, intake.respondent_name,
    intake.respondent_contact, intake.respondent_sitio, intake.respondent_resident_status, intake.narrative,
    intake.status, source, residentReportId, now, submittedAt, now
  ];
  const [result] = await connection.execute(
    `INSERT INTO blotters (case_id, barangay_id, city_id, created_by, incident_type, incident_datetime, sitio, landmark,
      complainant_name, complainant_contact, complainant_sitio, complainant_resident_status, respondent_unknown,
      respondent_name, respondent_contact, respondent_sitio, respondent_resident_status, narrative, status, source,
      resident_report_id, created_at, submitted_at, updated_at)
     VALUES (${values.map(() => '?').join(', ')})`, values
  );
  await connection.execute(
    'INSERT INTO case_events (blotter_id, barangay_id, event_type, actor_id, from_status, to_status, reason, created_at) VALUES (?, ?, ?, ?, NULL, ?, NULL, ?)',
    [result.insertId, tenant.barangay_id, 'created', actorId, intake.status, now]
  );
  return serializeBlotter(await fetchBlotter(connection, { id: result.insertId, barangayId: tenant.barangay_id }));
}

export async function createBlotter(pool, args) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const blotter = await insertBlotter(connection, args);
    await connection.commit();
    return blotter;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

export async function getBlotter(pool, id, barangayId) {
  const [rows] = await pool.execute(`SELECT ${BLOTTER_FIELDS} FROM blotters b JOIN users creator ON creator.id = b.created_by WHERE b.id = ? AND b.barangay_id = ?`, [id, barangayId]);
  return rows[0] ? serializeBlotter(rows[0]) : null;
}

function manilaDayStart(day) {
  return new Date(`${day}T00:00:00.000+08:00`);
}

export async function listBlotters(pool, tenantId, query, pagination) {
  const where = ['b.barangay_id = ?'];
  const params = [tenantId];
  if (query.status !== undefined) { where.push('b.status = ?'); params.push(query.status); }
  else where.push("b.status <> 'draft'");
  if (query.incident_type !== undefined) { where.push('b.incident_type = ?'); params.push(query.incident_type); }
  if (query.sitio !== undefined) { where.push('b.sitio = ?'); params.push(query.sitio); }
  if (query.q !== undefined && query.q !== '') {
    const like = `%${escapeLike(query.q)}%`;
    where.push('(b.case_id LIKE ? OR b.complainant_name LIKE ? OR COALESCE(b.respondent_name, \'\') LIKE ?)');
    params.push(like, like, like);
  }
  if (query.date_from) { where.push('b.incident_datetime >= ?'); params.push(manilaDayStart(query.date_from)); }
  if (query.date_to) {
    const end = new Date(manilaDayStart(query.date_to).getTime() + 86400000);
    where.push('b.incident_datetime < ?'); params.push(end);
  }
  const predicate = where.join(' AND ');
  const [[countRows], [rows]] = await Promise.all([
    pool.execute(`SELECT COUNT(*) AS total FROM blotters b WHERE ${predicate}`, params),
    pool.execute(`SELECT ${BLOTTER_FIELDS} FROM blotters b JOIN users creator ON creator.id = b.created_by WHERE ${predicate} ORDER BY ${query.status === 'draft' ? 'b.created_at DESC' : 'b.submitted_at DESC'}, b.id DESC LIMIT ? OFFSET ?`, [...params, pagination.pageSize, (pagination.page - 1) * pagination.pageSize])
  ]);
  const total = Number(countRows[0].total);
  return { data: rows.map(serializeBlotter), meta: { page: pagination.page, page_size: pagination.pageSize, total, total_pages: Math.ceil(total / pagination.pageSize) } };
}

export async function listEvents(pool, blotterId, barangayId) {
  const [rows] = await pool.execute(
    `SELECT e.id, e.event_type, e.actor_id, u.display_name AS actor_name, e.created_at, e.from_status, e.to_status, e.reason
     FROM case_events e JOIN users u ON u.id = e.actor_id JOIN blotters b ON b.id = e.blotter_id
     WHERE e.blotter_id = ? AND e.barangay_id = ? AND b.barangay_id = ? ORDER BY e.id ASC`,
    [blotterId, barangayId, barangayId]
  );
  return rows.map((row) => ({ ...row, id: Number(row.id), actor_id: Number(row.actor_id), created_at: iso(row.created_at) }));
}

const TRANSITIONS = {
  draft: new Set(['pending_lupon', 'settled_at_desk', 'referred_to_pnp']),
  pending_lupon: new Set(['settled_at_desk', 'referred_to_pnp', 'unresolved']),
  settled_at_desk: new Set(['pending_lupon']), referred_to_pnp: new Set(['pending_lupon']), unresolved: new Set(['pending_lupon'])
};

export async function changeBlotterStatus(pool, { id, tenantId, actorId, status, expectedVersion, reason }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const current = await fetchBlotter(connection, { id, barangayId: tenantId, forUpdate: true });
    if (!current) throw notFoundError();
    if (Number(current.version) !== expectedVersion) throw conflictError();
    if (current.status === status || !TRANSITIONS[current.status]?.has(status)) throw conflictError('This status transition is not allowed.');
    const reopens = ['settled_at_desk', 'referred_to_pnp', 'unresolved'].includes(current.status);
    if (reopens && (typeof reason !== 'string' || reason.trim().length < 1 || reason.trim().length > 1000)) throw conflictError('A reason is required to reopen this case.');
    const now = new Date();
    const submitted = current.status === 'draft' ? now : current.submitted_at;
    await connection.execute('UPDATE blotters SET status = ?, submitted_at = ?, updated_at = ?, version = version + 1 WHERE id = ? AND barangay_id = ? AND version = ?', [status, submitted, now, id, tenantId, expectedVersion]);
    await connection.execute('INSERT INTO case_events (blotter_id, barangay_id, event_type, actor_id, from_status, to_status, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [id, tenantId, 'status_changed', actorId, current.status, status, reopens ? reason.trim() : (reason?.trim() || null), now]);
    const updated = serializeBlotter(await fetchBlotter(connection, { id, barangayId: tenantId }));
    await connection.commit();
    return updated;
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

export async function getOverview(pool, tenantId) {
  const [[blotterRows], [reportRows]] = await Promise.all([
    pool.execute(`SELECT COUNT(*) AS total_blotters,
      SUM(status = 'pending_lupon') AS pending_lupon, SUM(status = 'settled_at_desk') AS settled_at_desk,
      SUM(status = 'referred_to_pnp') AS referred_to_pnp, SUM(status = 'unresolved') AS unresolved
      FROM blotters WHERE barangay_id = ? AND status <> 'draft'`, [tenantId]),
    pool.execute("SELECT COUNT(*) AS pending_reports FROM resident_reports WHERE barangay_id = ? AND status = 'pending_review'", [tenantId])
  ]);
  const blotters = blotterRows[0];
  return { total_blotters: Number(blotters.total_blotters || 0), pending_lupon: Number(blotters.pending_lupon || 0), settled_at_desk: Number(blotters.settled_at_desk || 0), referred_to_pnp: Number(blotters.referred_to_pnp || 0), unresolved: Number(blotters.unresolved || 0), pending_reports: Number(reportRows[0].pending_reports || 0) };
}
