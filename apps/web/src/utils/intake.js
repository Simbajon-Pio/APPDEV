const categories = {
  curfew_violation: 'Curfew Violation',
  noise_disturbance: 'Videoke / Noise Disturbance',
  property_dispute: 'Property Dispute',
  physical_altercation: 'Physical Altercation',
  financial_dispute: 'Debt / Financial Dispute',
  others: 'Others',
};
export const CATEGORY_OPTIONS = Object.entries(categories).map(([value, label]) => ({ value, label }));
export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_lupon', label: 'Pending Lupon' },
  { value: 'settled_at_desk', label: 'Settled at Desk' },
  { value: 'referred_to_pnp', label: 'Referred to PNP' },
  { value: 'unresolved', label: 'Unresolved' },
];
export const INITIAL_STATUS_OPTIONS = STATUS_OPTIONS.filter((status) => status.value !== 'unresolved');
export const RESIDENCY_OPTIONS = [
  { value: 'resident', label: 'Resident' },
  { value: 'non_resident', label: 'Non-resident' },
  { value: 'unknown', label: 'Unknown' },
];

const text = (value) => typeof value === 'string' ? value : '';
const optionalText = (value) => text(value).trim() ? text(value).trim() : null;
const validContact = (value) => {
  const clean = text(value).trim();
  return !clean || (/^[\d +()\-]{7,20}$/.test(clean) && (clean.match(/\d/g) || []).length >= 7);
};

export function toManilaTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return '';
  const [date, time] = value.split('T');
  const candidate = new Date(`${date}T${time}:00+08:00`);
  if (Number.isNaN(candidate.valueOf()) || candidate.toISOString().slice(0, 16) !== new Date(`${date}T${time}:00Z`).toISOString().slice(0, 16)) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const check = new Date(Date.UTC(year, month - 1, day, hour, minute));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return '';
  }
  return `${date}T${time}:00+08:00`;
}

export function fromManilaTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const part = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return `${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}`;
}

export function formatManilaDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function validateIntake(values) {
  const errors = {};
  if (!Object.hasOwn(categories, values.incident_type)) errors.incident_type = 'Choose an incident category.';
  if (!values.incident_datetime || !toManilaTimestamp(values.incident_datetime)) errors.incident_datetime = 'Enter a valid date and time.';
  else if (new Date(toManilaTimestamp(values.incident_datetime)) > new Date()) errors.incident_datetime = 'Incident time cannot be in the future.';
  if (!text(values.sitio).trim()) errors.sitio = 'Enter the incident sitio or purok.';
  else if (text(values.sitio).trim().length > 120) errors.sitio = 'Use 120 characters or fewer.';
  if (text(values.landmark).trim().length > 255) errors.landmark = 'Use 255 characters or fewer.';
  if (!text(values.complainant_name).trim()) errors.complainant_name = 'Enter the complainant name.';
  else if (text(values.complainant_name).trim().length > 160) errors.complainant_name = 'Use 160 characters or fewer.';
  if (!validContact(values.complainant_contact)) errors.complainant_contact = 'Enter at least seven digits using a valid contact format.';
  if (text(values.complainant_sitio).trim().length > 120) errors.complainant_sitio = 'Use 120 characters or fewer.';
  if (!RESIDENCY_OPTIONS.some(({ value }) => value === values.complainant_resident_status)) errors.complainant_resident_status = 'Choose a residency status.';
  if (typeof values.respondent_unknown !== 'boolean') errors.respondent_unknown = 'Choose whether the respondent is unknown.';
  if (values.respondent_unknown) {
    if (text(values.respondent_name).trim()) errors.respondent_name = 'Leave the name blank when respondent is unknown.';
    if (text(values.respondent_contact).trim()) errors.respondent_contact = 'Leave contact blank when respondent is unknown.';
    if (text(values.respondent_sitio).trim()) errors.respondent_sitio = 'Leave address blank when respondent is unknown.';
    if (values.respondent_resident_status !== 'unknown') errors.respondent_resident_status = 'Residency must be unknown when respondent is unknown.';
  } else {
    if (!text(values.respondent_name).trim()) errors.respondent_name = 'Enter the respondent name or mark unknown.';
    else if (text(values.respondent_name).trim().length > 160) errors.respondent_name = 'Use 160 characters or fewer.';
    if (!validContact(values.respondent_contact)) errors.respondent_contact = 'Enter at least seven digits using a valid contact format.';
    if (text(values.respondent_sitio).trim().length > 120) errors.respondent_sitio = 'Use 120 characters or fewer.';
    if (!RESIDENCY_OPTIONS.some(({ value }) => value === values.respondent_resident_status)) errors.respondent_resident_status = 'Choose a residency status.';
  }
  if (!text(values.narrative).trim()) errors.narrative = 'Describe what happened.';
  else if (text(values.narrative).trim().length > 5000) errors.narrative = 'Use 5,000 characters or fewer.';
  if (!INITIAL_STATUS_OPTIONS.some(({ value }) => value === values.status)) errors.status = 'Choose an allowed initial status.';
  return errors;
}

export function buildIntake(values) {
  return {
    incident_type: values.incident_type,
    incident_datetime: toManilaTimestamp(values.incident_datetime),
    sitio: text(values.sitio).trim(),
    landmark: optionalText(values.landmark),
    complainant_name: text(values.complainant_name).trim(),
    complainant_contact: optionalText(values.complainant_contact),
    complainant_sitio: optionalText(values.complainant_sitio),
    complainant_resident_status: values.complainant_resident_status,
    respondent_unknown: values.respondent_unknown,
    respondent_name: values.respondent_unknown ? null : text(values.respondent_name).trim(),
    respondent_contact: values.respondent_unknown ? null : optionalText(values.respondent_contact),
    respondent_sitio: values.respondent_unknown ? null : optionalText(values.respondent_sitio),
    respondent_resident_status: values.respondent_unknown ? 'unknown' : values.respondent_resident_status,
    narrative: text(values.narrative).trim(),
    status: values.status,
  };
}
export function blankIntake() {
  return { incident_type: '', incident_datetime: '', sitio: '', landmark: '', complainant_name: '', complainant_contact: '', complainant_sitio: '', complainant_resident_status: 'unknown', respondent_unknown: true, respondent_name: '', respondent_contact: '', respondent_sitio: '', respondent_resident_status: 'unknown', narrative: '', status: 'pending_lupon' };
}
