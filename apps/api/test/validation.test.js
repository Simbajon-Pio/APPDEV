import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIntake, escapeLike, isValidDateRange, validatePagination } from '../src/validation.js';
import { validatePublicReport } from '../src/routes.js';

const valid = {
  incident_type: 'noise_disturbance', incident_datetime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  sitio: 'Demo Purok 1', landmark: null, complainant_name: 'Demo Complainant',
  complainant_contact: null, complainant_sitio: null, complainant_resident_status: 'unknown',
  respondent_unknown: true, respondent_name: null, respondent_contact: null, respondent_sitio: null,
  respondent_resident_status: 'unknown', narrative: 'Synthetic incident narrative.', status: 'pending_lupon'
};

test('intake rejects client-supplied tenant and audit fields', () => {
  const result = validateIntake({ ...valid, barangay_id: 999, created_by: 999 });
  assert.equal(result.ok, false);
  assert.match(result.fields.barangay_id, /not allowed/i);
});

test('intake accepts valid fully populated data and normalizes blank optionals', () => {
  const result = validateIntake({ ...valid, landmark: '  ', complainant_contact: '' });
  assert.equal(result.ok, true);
  assert.equal(result.value.landmark, null);
  assert.equal(result.value.complainant_contact, null);
});

test('intake rejects future and invalid incident timestamps', () => {
  assert.equal(validateIntake({ ...valid, incident_datetime: 'not a date' }).ok, false);
  assert.equal(validateIntake({ ...valid, incident_datetime: '2999-01-01T00:00:00Z' }).ok, false);
});

test('literal search escapes SQL wildcard characters', () => {
  assert.equal(escapeLike('A%_\\B'), 'A\\%\\_\\\\B');
});

test('Philippine date range validates calendar dates and order', () => {
  assert.equal(isValidDateRange('2026-02-28', '2026-03-01'), true);
  assert.equal(isValidDateRange('2026-02-30', null), false);
  assert.equal(isValidDateRange('2026-03-02', '2026-03-01'), false);
});
