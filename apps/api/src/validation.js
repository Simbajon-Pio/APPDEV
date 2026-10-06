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
