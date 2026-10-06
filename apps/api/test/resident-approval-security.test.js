import test from 'node:test';
import assert from 'node:assert/strict';
import { validateApprovalAgainstOriginal } from '../src/services/resident-reports.js';

const report = {
  incident_type: 'property_dispute', incident_datetime: new Date('2025-10-05T16:30:00.000Z'),
  sitio: 'Purok 1', reporter_name: 'Synthetic Reporter', narrative: 'Original submitted narrative.',
  respondent_name: null, landmark: 'Original Landmark', reporter_contact: null
};
const intake = {
  incident_type: 'property_dispute', incident_datetime: new Date('2025-10-05T16:30:00.000Z'),
  sitio: 'Purok 1', complainant_name: 'Synthetic Reporter', complainant_contact: null,
  narrative: 'Original submitted narrative.', respondent_unknown: true, respondent_name: null,
  respondent_contact: null, respondent_sitio: null, respondent_resident_status: 'unknown',
  complainant_sitio: null, complainant_resident_status: 'unknown', landmark: null, status: 'pending_lupon'
};

test('resident approval compares MySQL datetime rows and equivalent explicit-offset timestamps', () => {
  const mysqlRow = { ...report, incident_datetime: '2025-10-05 16:30:00.000', landmark: null };
  const offsetIntake = { ...intake, incident_datetime: new Date('2025-10-05T16:30:00.000Z') };
  assert.deepEqual(validateApprovalAgainstOriginal(mysqlRow, offsetIntake), { ok: true });
});

test('resident approval rejects a timestamp shift smaller than one second', () => {
  const shifted = { ...intake, incident_datetime: new Date('2025-10-05T16:30:00.500Z') };
  const result = validateApprovalAgainstOriginal(report, shifted);
  assert.equal(result.ok, false);
  assert.ok(result.fields.incident_datetime);
});

test('resident approval rejects inventing absent respondent identity or contact', () => {
  const invented = validateApprovalAgainstOriginal(report, {
    ...intake, respondent_unknown: false, respondent_name: 'Invented Person', respondent_contact: '123456789'
  });
  assert.equal(invented.ok, false);
  assert.ok(invented.fields.respondent_name);
  assert.ok(invented.fields.respondent_contact);
});

test('resident approval accepts known values while preserving unknown respondent details as unknown', () => {
  const result = validateApprovalAgainstOriginal(report, { ...intake, landmark: 'Original Landmark' });
  assert.deepEqual(result, { ok: true });
});

test('resident approval rejects changing any submitted incident or reporter facts', () => {
  const changes = [
    ['incident_type', 'others'],
    ['incident_datetime', new Date('2025-10-06T16:30:00.000Z')],
    ['sitio', 'Different Purok'],
    ['complainant_name', 'Different Reporter'],
    ['narrative', 'Changed narrative'],
    ['landmark', 'Invented Landmark']
  ];
  for (const [field, value] of changes) {
    const result = validateApprovalAgainstOriginal(report, { ...intake, [field]: value });
    assert.equal(result.ok, false, field);
    assert.ok(result.fields[field], field);
  }
});

test('resident approval cannot add unsubmitted respondent contact or home location even when respondent name was submitted', () => {
  const knownRespondent = { ...report, respondent_name: 'Known Respondent' };
  const result = validateApprovalAgainstOriginal(knownRespondent, {
    ...intake, landmark: 'Original Landmark', respondent_unknown: false, respondent_name: 'Known Respondent',
    respondent_contact: '123456789', respondent_sitio: 'Invented Home Purok', respondent_resident_status: 'resident'
  });
  assert.equal(result.ok, false);
  assert.ok(result.fields.respondent_contact);
  assert.ok(result.fields.respondent_sitio);
  assert.ok(result.fields.respondent_resident_status);
});

test('resident approval cannot add unsubmitted party residence or residency details', () => {
  const result = validateApprovalAgainstOriginal(report, {
    ...intake, landmark: 'Original Landmark', complainant_sitio: 'Invented Home Purok',
    complainant_resident_status: 'resident'
  });
  assert.equal(result.ok, false);
  assert.ok(result.fields.complainant_sitio);
  assert.ok(result.fields.complainant_resident_status);
});

test('resident approval matches known supplied complainant and respondent details after normalization', () => {
  const knownDetails = {
    ...report,
    reporter_contact: '123456789',
    respondent_name: 'Known Respondent',
    respondent_contact: '987654321',
    respondent_sitio: 'Known Respondent Purok',
    landmark: null
  };
  const confirmedIntake = {
    ...intake,
    complainant_contact: '123456789',
    complainant_sitio: 'Known Complainant Purok',
    respondent_unknown: false,
    respondent_name: 'Known Respondent',
    respondent_contact: '987654321',
    respondent_sitio: 'Known Respondent Purok',
    complainant_resident_status: 'unknown',
    respondent_resident_status: 'unknown'
  };
  assert.deepEqual(validateApprovalAgainstOriginal(knownDetails, confirmedIntake), { ok: true });
});

test('known original contact and respondent details cannot be silently discarded or changed', () => {
  const known = { ...report, reporter_contact: '123456789', respondent_name: 'Known Respondent', landmark: 'Known Landmark' };
  const incomplete = validateApprovalAgainstOriginal(known, intake);
  assert.equal(incomplete.ok, false);
  assert.ok(incomplete.fields.complainant_contact);
  assert.ok(incomplete.fields.respondent_name);
  assert.ok(incomplete.fields.landmark);
  const changed = validateApprovalAgainstOriginal(known, {
    ...intake, complainant_contact: '987654321', respondent_unknown: false,
    respondent_name: 'Other Respondent', landmark: 'Other Landmark'
  });
  assert.equal(changed.ok, false);
  assert.ok(changed.fields.complainant_contact);
  assert.ok(changed.fields.respondent_name);
  assert.ok(changed.fields.landmark);
});
