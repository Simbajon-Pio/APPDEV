import { describe, expect, it } from 'vitest';
import { queryString, ApiError } from '../src/api/client.js';
import { validateResidentReport, buildResidentReport } from '../src/features/reports/validation.js';

describe('resident submission boundaries', () => {
  it('does not put empty filters in API query strings', () => {
    expect(queryString({ status: '', q: 'sample', page: 2 })).toBe('?q=sample&page=2');
  });
  it('validates the public form before it reaches the API', () => {
    expect(validateResidentReport({ reporter_name: '', incident_type: 'not-an-enum', incident_datetime: '', sitio: '', narrative: '' })).toMatchObject({ reporter_name: expect.any(String), incident_type: expect.any(String), narrative: expect.any(String) });
  });
  it('converts resident wall time to a +08:00 API timestamp', () => {
    expect(buildResidentReport({ reporter_name: 'Synthetic Reporter', reporter_contact: '', incident_type: 'others', incident_datetime: '2026-10-06T20:30', sitio: 'Demo Purok', landmark: '', respondent_name: '', narrative: 'Synthetic incident' }).incident_datetime).toBe('2026-10-06T20:30:00+08:00');
  });
  it('rejects malformed resident local date-time before serialization', () => {
    expect(validateResidentReport({ reporter_name: 'Synthetic Reporter', incident_type: 'others', incident_datetime: '2026-02-30T20:30', sitio: 'Demo Purok', narrative: 'Synthetic incident' })).toHaveProperty('incident_datetime');
  });
  it('retains server conflict details and does not synthesize a case success', () => {
    const conflict = new ApiError({ status: 409, code: 'CONFLICT', message: 'Already reviewed.' });
    expect(conflict).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Already reviewed.' });
  });
});
