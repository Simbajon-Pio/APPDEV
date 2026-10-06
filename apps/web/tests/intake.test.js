import { describe, expect, it } from 'vitest';
import { toManilaTimestamp, fromManilaTimestamp, formatManilaDateTime, validateIntake } from '../src/utils/intake.js';

const complete = {
  incident_type: 'noise_disturbance', incident_datetime: '2020-10-06T20:30', sitio: 'Purok 1', landmark: '',
  complainant_name: 'Sample Reporter', complainant_contact: '', complainant_sitio: '', complainant_resident_status: 'unknown',
  respondent_unknown: true, respondent_name: '', respondent_contact: '', respondent_sitio: '', respondent_resident_status: 'unknown',
  narrative: 'Synthetic report narrative.', status: 'pending_lupon',
};

describe('staff intake behavior', () => {
  it('converts Philippine wall time to an explicit +08:00 API timestamp', () => {
    expect(toManilaTimestamp('2026-10-06T20:30')).toBe('2026-10-06T20:30:00+08:00');
  });
  it('renders an offset response as Philippine civil time', () => {
    expect(fromManilaTimestamp('2026-10-06T12:30:00.000Z')).toBe('2026-10-06T20:30');
    expect(formatManilaDateTime('2026-10-06T12:30:00.000Z')).toContain('8:30 PM');
  });
  it('rejects missing required values and unknown respondent fabrication', () => {
    expect(validateIntake({ ...complete, sitio: '', respondent_name: 'Invented name' })).toMatchObject({ sitio: expect.any(String), respondent_name: expect.any(String) });
  });
  it('keeps unknown respondent values empty, and makes known respondent selection explicit', () => {
    expect(validateIntake(complete)).toEqual({});
    expect(validateIntake({ ...complete, respondent_unknown: false, respondent_name: '' })).toMatchObject({ respondent_name: expect.any(String) });
    expect(validateIntake({ ...complete, respondent_unknown: true, respondent_name: 'Invented' })).toMatchObject({ respondent_name: expect.any(String) });
  });
  it('validates partial inputs without crashing on absent optional fields', () => {
    expect(validateIntake({ incident_type: 'others', incident_datetime: '2020-10-06T20:30', sitio: ' ', complainant_name: 'Sample Reporter', respondent_unknown: true, respondent_resident_status: 'unknown', status: 'pending_lupon' })).toMatchObject({ sitio: expect.any(String), narrative: expect.any(String) });
  });
});
