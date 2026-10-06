import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimestamp, validatePagination, validateIntake } from '../src/validation.js';
import { validatePublicReport } from '../src/routes.js';

const validIntake = {
  incident_type: 'noise_disturbance', incident_datetime: '2026-10-06T10:00:00Z', sitio: 'Synthetic Purok',
  complainant_name: 'Synthetic Resident', complainant_resident_status: 'unknown', respondent_unknown: true,
  respondent_name: null, respondent_contact: null, respondent_sitio: null, respondent_resident_status: 'unknown',
  narrative: 'Synthetic only.', status: 'pending_lupon'
};

test('timestamp parser rejects impossible calendar dates and malformed offsets', () => {
  assert.equal(parseTimestamp('2026-02-30T10:00:00Z', Date.parse('2026-12-31T00:00:00Z')), null);
  assert.equal(parseTimestamp('2026-10-06T10:00:00+99:00', Date.parse('2026-12-31T00:00:00Z')), null);
  assert.equal(parseTimestamp('2026-10-06T10:00:00Z', Date.parse('2026-10-07T00:00:00Z')) instanceof Date, true);
});

test('pagination rejects decimals, signs, and numeric coercion of empty values', () => {
  assert.equal(validatePagination({ page: '1.5' }).ok, false);
  assert.equal(validatePagination({ page_size: '+2' }).ok, false);
  assert.equal(validatePagination({ page: '' }).ok, false);
  assert.equal(validatePagination({ page: '1', page_size: '100' }).ok, true);
});

test('intake rejects unknown respondent facts rather than overwriting them', () => {
  assert.equal(validateIntake({ ...validIntake, respondent_unknown: true, respondent_name: 'Invented Person' }).fields.respondent_name, 'Must be null when respondent is unknown');
});

test('public report validates contact and rejects client-owned review fields', () => {
  const body = {
    reporter_name: 'Synthetic Reporter', reporter_contact: '123-45', incident_type: 'others',
    incident_datetime: '2026-10-06T10:00:00Z', sitio: 'Synthetic Purok', narrative: 'Synthetic report.'
  };
  assert.equal(validatePublicReport(body).fields.reporter_contact, 'Enter a valid contact');
  assert.equal(validatePublicReport({ ...body, reporter_contact: null, barangay_id: 1 }).fields.barangay_id, 'Unknown field');
});
