import { describe, expect, it, vi, beforeEach } from 'vitest';
import { api, ApiError, bootstrapCsrf, login, logout, setCsrfToken } from '../src/api/client.js';

describe('contract API client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCsrfToken(null);
  });

  it('unwraps success envelopes, includes cookies, and preserves snake_case payloads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { total_blotters: 2 } }), { status: 200 }));
    const result = await api.get('/overview');
    expect(result).toEqual({ total_blotters: 2 });
    expect(fetchMock).toHaveBeenCalledWith('/api/overview', expect.objectContaining({ credentials: 'include', headers: expect.any(Headers) }));
  });

  it('bootstraps CSRF before login and retains the rotated token for mutations', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrf_token: 'anonymous-csrf' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { user: { id: 3 }, csrf_token: 'staff-csrf' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { logged_out: true } }), { status: 200 }));
    await bootstrapCsrf();
    const session = await login({ username: 'desk', password: 'not-a-secret' });
    expect(session.user.id).toBe(3);
    await api.post('/auth/logout', {});
    expect(fetchMock.mock.calls[1][1].headers.get('X-CSRF-Token')).toBe('anonymous-csrf');
    expect(fetchMock.mock.calls[2][1].headers.get('X-CSRF-Token')).toBe('staff-csrf');
  });

  it('preserves the CSRF token after logout fails so an authenticated retry can succeed', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrf_token: 'current-token' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Logout failed.' } }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { logged_out: true } }), { status: 200 }));
    await bootstrapCsrf();
    await expect(logout()).rejects.toMatchObject({ status: 500 });
    await logout();
    expect(fetchMock.mock.calls[1][1].headers.get('X-CSRF-Token')).toBe('current-token');
    expect(fetchMock.mock.calls[2][1].headers.get('X-CSRF-Token')).toBe('current-token');
  });

  it('preserves list metadata separately from the contract data array', async () => {
    const meta = { page: 2, page_size: 20, total: 41, total_pages: 3 };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 7 }], meta }), { status: 200 }));
    await expect(api.getList('/blotters?page=2')).resolves.toEqual({ items: [{ id: 7 }], meta });
  });

  it('maps field validation and stale conflicts to typed errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Check the marked fields.', fields: { sitio: 'Required' } } }), { status: 422 }));
    await expect(api.post('/blotters', {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR', fields: { sitio: 'Required' }, status: 422 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'The record changed.' } }), { status: 409 }));
    await expect(api.post('/blotters/5/status', {})).rejects.toBeInstanceOf(ApiError);
  });
});
