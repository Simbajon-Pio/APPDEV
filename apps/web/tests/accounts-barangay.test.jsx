import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const reportUrl = 'https://example.test/report/cebu-city-lahug';
const adminUser = { id: 1, username: 'demo_a', display_name: 'Demo Staff A', role: 'admin', barangay: { id: 1, name: 'Lahug', code: 'CEB040', slug: 'cebu-city-lahug' }, city: { id: 1, name: 'Cebu City' }, report_url: reportUrl };
const staffUser = { ...adminUser, id: 3, username: 'demo_a_staff', display_name: 'Demo Desk Staff A', role: 'staff' };
const overviewCounts = { total_blotters: 0, pending_lupon: 0, settled_at_desk: 0, referred_to_pnp: 0, unresolved: 0, pending_reports: 0 };
const accountRows = [
  { id: 1, username: 'demo_a', display_name: 'Demo Staff A', role: 'admin', is_active: true, created_at: '2026-11-01T00:00:00.000Z' },
  { id: 3, username: 'demo_a_staff', display_name: 'Demo Desk Staff A', role: 'staff', is_active: true, created_at: '2026-11-01T00:00:00.000Z' },
];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Routes are matched by "METHOD /api/path" so each test states exactly which backend responses it depends on.
function mockApi(routes) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init = {}) => {
    const key = `${init.method || 'GET'} ${new URL(url, 'http://localhost').pathname}`;
    if (!(key in routes)) throw new Error(`Unexpected request: ${key}`);
    const response = routes[key];
    return json(response.body, response.status);
  });
}

function signedInRoutes(user, extra = {}) {
  return {
    'GET /api/auth/csrf': { body: { data: { csrf_token: 'test-csrf' } } },
    'GET /api/auth/me': { body: { data: { user, csrf_token: 'test-csrf' } } },
    'GET /api/overview': { body: { data: overviewCounts } },
    ...extra,
  };
}

function renderApp(path) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('staff navigation by role', () => {
  it('hides Accounts from desk staff but keeps Barangay and labels the role', async () => {
    mockApi(signedInRoutes(staffUser));
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^accounts$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^barangay$/i })).toHaveAttribute('href', '/barangay');
    expect(screen.getByText('Desk staff')).toBeInTheDocument();
  });

  it('shows Accounts to administrators', async () => {
    mockApi(signedInRoutes(adminUser));
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^accounts$/i })).toHaveAttribute('href', '/accounts');
    expect(screen.getByText('Administrator')).toBeInTheDocument();
  });
});

describe('accounts page', () => {
  it('tells desk staff that account management is restricted without calling the accounts API', async () => {
    const fetchMock = mockApi(signedInRoutes(staffUser));
    renderApp('/accounts');
    expect(await screen.findByText('Account management is available to barangay administrators.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/accounts'))).toBe(false);
  });

  it('lists accounts and submits a new desk account with the typed values', async () => {
    const user = userEvent.setup();
    const created = { id: 4, username: 'new_desk', display_name: 'New Desk', role: 'staff', is_active: true, created_at: '2026-11-05T00:00:00.000Z' };
    const fetchMock = mockApi({
      ...signedInRoutes(adminUser),
      'GET /api/accounts': { body: { data: accountRows } },
      'POST /api/accounts': { body: { data: created }, status: 201 },
    });
    renderApp('/accounts');
    const table = await screen.findByRole('table');
    expect(within(table).getByText('demo_a_staff')).toBeInTheDocument();
    expect(within(table).getByText('Demo Desk Staff A')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Deactivate' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Make desk staff' })[0]).toBeDisabled();

    await user.type(screen.getByLabelText(/username/i), 'new_desk');
    await user.type(screen.getByLabelText(/display name/i), 'New Desk');
    await user.type(screen.getByLabelText(/temporary password/i), 'Synthetic-Pass-2026');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Created new_desk.');
    const post = fetchMock.mock.calls.find(([url, init]) => url === '/api/accounts' && init?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({ username: 'new_desk', display_name: 'New Desk', role: 'staff', password: 'Synthetic-Pass-2026' });
    expect(post[1].headers.get('X-CSRF-Token')).toBe('test-csrf');
  });
});

describe('barangay profile page', () => {
  it('shows the public report link and QR code for staff in read-only mode', async () => {
    mockApi({
      ...signedInRoutes(staffUser),
      'GET /api/barangay': { body: { data: { id: 1, name: 'Lahug', code: 'CEB040', slug: 'cebu-city-lahug', hall_address: 'Synthetic Hall Road 1', contact_number: '032 555-0100', city: { id: 1, name: 'Cebu City' }, report_url: reportUrl } } },
    });
    renderApp('/barangay');
    expect(await screen.findByRole('heading', { name: 'Lahug' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: reportUrl })).toHaveAttribute('href', reportUrl);
    expect(screen.getByRole('img', { name: `QR code for ${reportUrl}` })).toBeInTheDocument();
    expect(screen.getByText('Synthetic Hall Road 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });
});

describe('public report page barangay details', () => {
  it('shows the hall address and contact number when the barangay has them', async () => {
    mockApi({
      'GET /api/public/barangays/cebu-city-lahug': { body: { data: { name: 'Lahug', slug: 'cebu-city-lahug', city_name: 'Cebu City', code: 'CEB040', report_url: reportUrl, hall_address: 'Synthetic Hall Road 1', contact_number: '032 555-0100' } } },
    });
    renderApp('/report/cebu-city-lahug');
    expect(await screen.findByText('Synthetic Hall Road 1')).toBeInTheDocument();
    expect(screen.getByText(/032 555-0100/)).toBeInTheDocument();
  });
});
