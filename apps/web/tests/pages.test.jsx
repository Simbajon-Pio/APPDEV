import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../src/App.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function CurrentPath() { return <output data-testid="current-path">{useLocation().pathname}</output>; }
function renderApp(path = '/login') {
  return render(<MemoryRouter initialEntries={[path]}><CurrentPath /><App /></MemoryRouter>);
}

describe('public reporting', () => {
  it('shows the safety notice, configured link, QR, and required field errors', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { name: 'Demo Barangay', slug: 'demo-barangay', city_name: 'Demo City', code: 'DEMO', report_url: 'https://example.test/report/demo-barangay' } }), { status: 200 }));
    renderApp('/report/demo-barangay');
    expect(await screen.findByRole('heading', { name: /report an incident/i })).toBeInTheDocument();
    expect(screen.getByText(/not an emergency response channel/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /https:\/\/example\.test\/report\/demo-barangay/i })).toHaveAttribute('href', 'https://example.test/report/demo-barangay');
    expect(screen.getByRole('img', { name: /qr code for/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /send report/i }));
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();
  });
});

describe('staff sign-in', () => {
  it('does not describe an initial signed-out session as expired', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrf_token: 'anonymous' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } }), { status: 401 }));
    renderApp('/login');
    expect(await screen.findByRole('textbox', { name: /username/i })).toBeInTheDocument();
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });

  it('retains the authenticated context and CSRF token after a failed logout', async () => {
    const user = userEvent.setup();
    const signedIn = { id: 3, username: 'desk', display_name: 'Desk Officer', barangay: { id: 1, name: 'Demo Barangay', code: 'DEMO' }, city: { id: 1, name: 'Demo City' } };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrf_token: 'current-csrf' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { user: signedIn, csrf_token: 'current-csrf' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { total_blotters: 0, pending_lupon: 0, settled_at_desk: 0, referred_to_pnp: 0, unresolved: 0, pending_reports: 0 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Logout failed.' } }), { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { logged_out: true } }), { status: 200 }));
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByText('Logout failed.')).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/');
    expect(screen.getByText('Desk Officer')).toBeInTheDocument();
    expect(fetchMock.mock.calls[3][1].headers.get('X-CSRF-Token')).toBe('current-csrf');
    await user.click(screen.getByRole('button', { name: /sign out/i }));
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(fetchMock.mock.calls[4][1].headers.get('X-CSRF-Token')).toBe('current-csrf');
  });
});
