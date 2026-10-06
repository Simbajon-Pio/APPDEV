import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

function renderApp(path = '/login') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { name: 'Demo Barangay', slug: 'demo-barangay', city_name: 'Demo City', code: 'DEMO', report_url: 'https://example.test/report/demo-barangay' } }), { status: 200 }));
});

describe('public reporting', () => {
  it('shows the community safety notice and requires the contracted report fields', async () => {
    const user = userEvent.setup();
    renderApp('/report/demo-barangay');
    expect(await screen.findByRole('heading', { name: /report an incident/i })).toBeInTheDocument();
    expect(screen.getByText(/not an emergency response channel/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /https:\/\/example\.test\/report\/demo-barangay/i })).toHaveAttribute('href', 'https://example.test/report/demo-barangay');
    expect(screen.getByRole('img', { name: /qr code for/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /send report/i }));
    expect(await screen.findByText(/enter your full name/i)).toBeInTheDocument();
  });
});

describe('staff sign in', () => {
  it('does not describe an initial signed-out session as expired', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrf_token: 'anonymous' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } }), { status: 401 }));
    renderApp('/login');
    expect(await screen.findByRole('textbox', { name: /username/i })).toBeInTheDocument();
    expect(screen.queryByText(/session expired/i)).not.toBeInTheDocument();
  });
});
