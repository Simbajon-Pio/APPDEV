import { toManilaTimestamp } from '../../utils/intake.js';

const types = ['curfew_violation', 'noise_disturbance', 'property_dispute', 'physical_altercation', 'financial_dispute', 'others'];
const contactOk = (value) => !value || (/^[\d +()\-]{7,20}$/.test(value.trim()) && (value.match(/\d/g) || []).length >= 7);
export function validateResidentReport(values) {
  const errors = {};
  if (!values.reporter_name?.trim()) errors.reporter_name = 'Enter your full name.';
  else if (values.reporter_name.trim().length > 160) errors.reporter_name = 'Use 160 characters or fewer.';
  if (!contactOk(values.reporter_contact || '')) errors.reporter_contact = 'Enter at least seven digits using a valid contact format.';
  if (!types.includes(values.incident_type)) errors.incident_type = 'Choose an incident category.';
  if (!values.incident_datetime || !toManilaTimestamp(values.incident_datetime)) errors.incident_datetime = 'Enter a valid date and time.';
  else if (new Date(toManilaTimestamp(values.incident_datetime)) > new Date()) errors.incident_datetime = 'Incident time cannot be in the future.';
  if (!values.sitio?.trim()) errors.sitio = 'Enter the incident sitio or purok.';
  else if (values.sitio.trim().length > 120) errors.sitio = 'Use 120 characters or fewer.';
  if ((values.landmark || '').trim().length > 255) errors.landmark = 'Use 255 characters or fewer.';
  if ((values.respondent_name || '').trim().length > 160) errors.respondent_name = 'Use 160 characters or fewer.';
  if (!values.narrative?.trim()) errors.narrative = 'Describe what happened.';
  else if (values.narrative.trim().length > 5000) errors.narrative = 'Use 5,000 characters or fewer.';
  return errors;
}
export function buildResidentReport(values) {
  const optional = (value) => value?.trim() || null;
  const local = values.incident_datetime;
  const incident_datetime = toManilaTimestamp(local);
  if (!incident_datetime) throw new TypeError('A valid Philippine date and time is required.');
  return {
    reporter_name: values.reporter_name.trim(),
    reporter_contact: optional(values.reporter_contact),
    incident_type: values.incident_type,
    incident_datetime,
    sitio: values.sitio.trim(),
    landmark: optional(values.landmark),
    respondent_name: optional(values.respondent_name),
    narrative: values.narrative.trim(),
    ...(values.website !== undefined ? { website: values.website } : {}),
  };
}
export function blankResidentReport() {
  return { reporter_name: '', reporter_contact: '', incident_type: '', incident_datetime: '', sitio: '', landmark: '', respondent_name: '', narrative: '', website: '' };
}
