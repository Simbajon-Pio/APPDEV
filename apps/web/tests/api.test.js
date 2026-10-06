import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, bootstrapCsrf, login, logout, setCsrfToken } from '../src/api/client.js';
import { toManilaTimestamp, validateIntake } from '../src/utils/intake.js';

afterEach(() => {
  vi.unstubAllGlobals();
  setCsrfToken(null);
});

describe('API contract client', () => {
  it('includes same-origin cookies and unwraps a successful data envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 11 } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(api.get('/blotters')).resolves.toEqual({ id: 11 });
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/blotters');
  });

  it('bootstraps CSRF before logout and sends the active token', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrf_token: 'fresh-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { logged_out: true } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await bootstrapCsrf();
    await logout();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/csrf');
    expect(fetchMock.mock.calls[1][1].headers.get('X-CSRF-Token')).toBe('fresh-token');
  });

  it('stores the rotated CSRF token after login', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrf_token: 'anonymous-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrf_token: 'staff-token', user: { id: 4 } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { logged_out: true } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(login({ username: 'desk', password: 'synthetic-password' })).resolves.toMatchObject({ user: { id: 4 } });
    await logout();
    expect(fetchMock.mock.calls[1][1].headers.get('X-CSRF-Token')).toBe('anonymous-token');
    expect(fetchMock.mock.calls[2][1].headers.get('X-CSRF-Token')).toBe('staff-token');
  });

  it('maps API validation envelopes to actionable errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Check the marked fields.', fields: { sitio: 'Required' } } }), { status: 422 })));
    await expect(api.post('/blotters', {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fields: { sitio: 'Required' } });
  });

  it('converts Philippine local date-time to an explicit +08:00 offset', () => {
    expect(toManilaTimestamp('2026-10-06T20:30')).toBe('2026-10-06T20:30:00+08:00');
  });

  it('rejects a blank required sitio and leaves submitted data untouched', () => {
    const intake = { incident_type: 'others', incident_datetime: '2020-10-06T20:30', sitio: ' ', complainant_name: 'Test User', complainant_resident_status: 'unknown', respondent_unknown: true, respondent_name: '', respondent_contact: '', respondent_sitio: '', respondent_resident_status: 'unknown', narrative: 'Incident details', status: 'pending_lupon' };
    expect(validateIntake(intake).sitio).toBe('Enter the incident sitio or purok.');
    expect(intake.sitio).toBe(' ');
  });
});
