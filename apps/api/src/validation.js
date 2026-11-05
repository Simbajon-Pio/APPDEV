import { CATEGORY_VALUES, RESIDENCY_VALUES, STATUS_VALUES } from './constants.js';

const PROTECTED_FIELDS = ['id', 'case_id', 'barangay_id', 'city_id', 'created_by', 'created_at', 'submitted_at', 'version'];
const REQUIRED_INTAKE_FIELDS = [
  'incident_type', 'incident_datetime', 'sitio', 'complainant_name', 'complainant_resident_status',
  'respondent_unknown', 'respondent_resident_status', 'narrative', 'status'
];

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function trimOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function textField(value, max, { required = false, name, fields }) {
  const normalized = trimOrNull(value);
  if (normalized === null) {
    if (required) fields[name] = 'Required';
    return null;
  }
  if (typeof normalized !== 'string') {
    fields[name] = 'Must be text';
    return null;
  }
  if (normalized.length > max) fields[name] = `Must be at most ${max} characters`;
  return normalized;
}

function validContact(value) {
  if (value === null) return true;
  const digits = value.replace(/\D/g, '');
  return value.length >= 7 && value.length <= 20 && /^[0-9 +()\-]+$/.test(value) && digits.length >= 7;
}

export function parseTimestamp(value, now = Date.now()) {
  const match = typeof value === 'string' && /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,9})?)?(Z|([+-])(\d\d):(\d\d))$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = '0', , , , , offsetHour = '0', offsetMinute = '0'] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCDate() !== Number(day) ||
      Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59 || Number(offsetHour) > 14 || Number(offsetMinute) > 59 || (Number(offsetHour) === 14 && Number(offsetMinute) > 0)) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > now) return null;
  return new Date(timestamp);
}

export function validateIntake(input, { allowDraft = true, now = Date.now() } = {}) {
  const fields = {};
  if (!isRecord(input)) return { ok: false, fields: { body: 'Must be a JSON object' } };
  for (const key of PROTECTED_FIELDS) if (Object.hasOwn(input, key)) fields[key] = 'Field is not allowed';
  const allowed = new Set([
    ...REQUIRED_INTAKE_FIELDS, 'landmark', 'complainant_contact', 'complainant_sitio',
    'respondent_name', 'respondent_contact', 'respondent_sitio'
  ]);
  for (const key of Object.keys(input)) if (!allowed.has(key) && !PROTECTED_FIELDS.includes(key)) fields[key] = 'Unknown field';
  for (const key of REQUIRED_INTAKE_FIELDS) if (!Object.hasOwn(input, key)) fields[key] = 'Required';

  const value = {};
  if (typeof input.incident_type !== 'string' || !CATEGORY_VALUES.has(input.incident_type)) fields.incident_type = 'Choose a valid incident type';
  else value.incident_type = input.incident_type;
  const timestamp = parseTimestamp(input.incident_datetime, now);
  if (!timestamp) fields.incident_datetime = 'Must be a valid timestamp with an explicit offset, no later than now';
  else value.incident_datetime = timestamp;
  value.sitio = textField(input.sitio, 120, { required: true, name: 'sitio', fields });
  value.landmark = textField(input.landmark, 255, { name: 'landmark', fields });
  value.complainant_name = textField(input.complainant_name, 160, { required: true, name: 'complainant_name', fields });
  value.complainant_contact = textField(input.complainant_contact, 20, { name: 'complainant_contact', fields });
  value.complainant_sitio = textField(input.complainant_sitio, 120, { name: 'complainant_sitio', fields });
  if (!RESIDENCY_VALUES.has(input.complainant_resident_status)) fields.complainant_resident_status = 'Choose a valid residency value';
  else value.complainant_resident_status = input.complainant_resident_status;

  if (typeof input.respondent_unknown !== 'boolean') fields.respondent_unknown = 'Must be true or false';
  else value.respondent_unknown = input.respondent_unknown;
  value.respondent_name = textField(input.respondent_name, 160, { required: input.respondent_unknown !== true, name: 'respondent_name', fields });
  value.respondent_contact = textField(input.respondent_contact, 20, { name: 'respondent_contact', fields });
  value.respondent_sitio = textField(input.respondent_sitio, 120, { name: 'respondent_sitio', fields });
  if (!RESIDENCY_VALUES.has(input.respondent_resident_status)) fields.respondent_resident_status = 'Choose a valid residency value';
  else value.respondent_resident_status = input.respondent_resident_status;
  if (input.respondent_unknown === true) {
    for (const name of ['respondent_name', 'respondent_contact', 'respondent_sitio']) {
      if (value[name] !== null) fields[name] = 'Must be null when respondent is unknown';
      value[name] = null;
    }
    if (input.respondent_resident_status !== 'unknown') fields.respondent_resident_status = 'Must be unknown when respondent is unknown';
    value.respondent_resident_status = 'unknown';
  } else if (input.respondent_unknown === false && value.respondent_name === null) fields.respondent_name = 'Required when respondent is known';
  for (const key of ['complainant_contact', 'respondent_contact']) if (value[key] !== null && !validContact(value[key])) fields[key] = 'Enter 7–20 valid characters containing at least 7 digits';
  value.narrative = textField(input.narrative, 5000, { required: true, name: 'narrative', fields });
  if (typeof input.status !== 'string' || !STATUS_VALUES.has(input.status) || input.status === 'unresolved' || (!allowDraft && input.status === 'draft')) fields.status = 'Choose a valid initial status';
  else value.status = input.status;

  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, value };
}

export function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function isValidDateRange(from, to) {
  const valid = (value) => value == null || (typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && (() => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  })());
  return valid(from) && valid(to) && !(from && to && from > to);
}

export function validatePagination(query) {
  const pageText = query.page === undefined ? '1' : String(query.page);
  const pageSizeText = query.page_size === undefined ? '20' : String(query.page_size);
  const page = Number(pageText);
  const pageSize = Number(pageSizeText);
  if (!/^\d+$/.test(pageText) || !Number.isSafeInteger(page) || page < 1) return { ok: false, fields: { page: 'Must be a positive integer' } };
  if (!/^\d+$/.test(pageSizeText) || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) return { ok: false, fields: { page_size: 'Must be an integer from 1 to 100' } };
  return { ok: true, page, pageSize };
}

export function validateListQuery(query, { reports = false } = {}) {
  const allowed = new Set(reports ? ['status', 'q', 'page', 'page_size'] : ['page', 'page_size', 'q', 'incident_type', 'status', 'sitio', 'date_from', 'date_to']);
  const fields = {};
  for (const key of Object.keys(query)) if (!allowed.has(key)) fields[key] = 'Unknown filter';
  const pagination = validatePagination(query);
  if (!pagination.ok) Object.assign(fields, pagination.fields);
  if (query.q !== undefined && (typeof query.q !== 'string' || query.q.length > (reports ? 160 : 160))) fields.q = 'Must be at most 160 characters';
  if (reports) {
    if (query.status !== undefined && !['pending_review', 'approved', 'rejected'].includes(query.status)) fields.status = 'Choose a valid review status';
  } else {
    if (query.incident_type !== undefined && !CATEGORY_VALUES.has(query.incident_type)) fields.incident_type = 'Choose a valid incident type';
    if (query.status !== undefined && !STATUS_VALUES.has(query.status)) fields.status = 'Choose a valid status';
    if (query.sitio !== undefined && (typeof query.sitio !== 'string' || query.sitio.length > 120)) fields.sitio = 'Must be at most 120 characters';
    if (!isValidDateRange(query.date_from, query.date_to)) fields.date_from = 'Enter valid, ordered Philippine calendar dates';
  }
  return Object.keys(fields).length ? { ok: false, fields } : { ok: true, ...pagination };
}

export function routeId(value) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function unknownFields(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { body: 'Must be a JSON object' };
  const fields = {};
  for (const key of Object.keys(body)) if (!allowed.has(key)) fields[key] = 'Unknown field';
  return fields;
}

const ROLE_VALUES = new Set(['admin', 'staff']);

export function validateNewAccount(body) {
  const fields = unknownFields(body, new Set(['username', 'display_name', 'role', 'password']));
  if (fields.body) return { ok: false, fields };
  for (const name of ['username', 'display_name', 'role', 'password']) if (!Object.hasOwn(body, name)) fields[name] = 'Required';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  if (Object.hasOwn(body, 'username') && !/^[a-z0-9_.]{3,80}$/.test(username)) fields.username = 'Use 3–80 letters, numbers, dots, or underscores';
  const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
  if (Object.hasOwn(body, 'display_name') && (displayName.length < 1 || displayName.length > 160)) fields.display_name = 'Must contain 1–160 characters';
  if (Object.hasOwn(body, 'role') && !ROLE_VALUES.has(body.role)) fields.role = 'Choose administrator or staff';
  if (Object.hasOwn(body, 'password') && (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128)) fields.password = 'Use 10–128 characters';
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { username, display_name: displayName, role: body.role, password: body.password } };
}

export function validateAccountUpdate(body) {
  const fields = unknownFields(body, new Set(['display_name', 'role', 'is_active']));
  if (fields.body) return { ok: false, fields };
  const value = {};
  if (Object.hasOwn(body, 'display_name')) {
    const displayName = typeof body.display_name === 'string' ? body.display_name.trim() : '';
    if (displayName.length < 1 || displayName.length > 160) fields.display_name = 'Must contain 1–160 characters';
    else value.display_name = displayName;
  }
  if (Object.hasOwn(body, 'role')) {
    if (!ROLE_VALUES.has(body.role)) fields.role = 'Choose administrator or staff';
    else value.role = body.role;
  }
  if (Object.hasOwn(body, 'is_active')) {
    if (typeof body.is_active !== 'boolean') fields.is_active = 'Must be true or false';
    else value.is_active = body.is_active;
  }
  if (!Object.keys(value).length && !Object.keys(fields).length) fields.body = 'Provide at least one field to update';
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value };
}

export function validatePasswordReset(body) {
  const fields = unknownFields(body, new Set(['password']));
  if (fields.body) return { ok: false, fields };
  if (!Object.hasOwn(body, 'password')) fields.password = 'Required';
  else if (typeof body.password !== 'string' || body.password.length < 10 || body.password.length > 128) fields.password = 'Use 10–128 characters';
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value: { password: body.password } };
}

export function validateBarangayUpdate(body) {
  const fields = unknownFields(body, new Set(['name', 'hall_address', 'contact_number']));
  if (fields.body) return { ok: false, fields };
  const value = {};
  if (Object.hasOwn(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 1 || name.length > 120) fields.name = 'Must contain 1–120 characters';
    else value.name = name;
  }
  if (Object.hasOwn(body, 'hall_address')) {
    const address = trimOrNull(body.hall_address);
    if (address !== null && (typeof address !== 'string' || address.length > 255)) fields.hall_address = 'Must be at most 255 characters';
    else value.hall_address = address;
  }
  if (Object.hasOwn(body, 'contact_number')) {
    const contact = trimOrNull(body.contact_number);
    if (contact !== null && (typeof contact !== 'string' || !/^[0-9 +()\-]{7,20}$/.test(contact) || contact.replace(/\D/g, '').length < 7)) fields.contact_number = 'Enter a valid contact number';
    else value.contact_number = contact;
  }
  if (!Object.keys(value).length && !Object.keys(fields).length) fields.body = 'Provide at least one field to update';
  if (Object.keys(fields).length) return { ok: false, fields };
  return { ok: true, value };
}
