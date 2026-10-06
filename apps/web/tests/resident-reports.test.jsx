import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ResidentReportsPage } from '../src/features/reports/ResidentReportsPage.jsx';

afterEach(() => vi.restoreAllMocks());

function listResponse({ page, status = 'pending_review', q = '' }) {
  const report = {
    id: status === 'approved' ? page + 10 : page,
    reference: status === 'approved' ? `RPT-approved-${q || 'all'}-${page}` : `RPT-pending-reference-${page}`,
    status,
    submitted_at: '2026-10-06T12:30:00.000Z',
    original: { reporter_name: q ? `Filtered ${q}` : `Synthetic Reporter ${page}`, incident_type: 'others' },
  };
  const total = q ? 1 : 21;
  return new Response(JSON.stringify({ data: [report], meta: { page, page_size: 20, total, total_pages: q ? 1 : 2 } }), { status: 200 });
}

describe('resident report queue', () => {
  it('loads the live queue on mount and fetches the next API page', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      return listResponse({
        page: Number(url.searchParams.get('page')) || 1,
        status: url.searchParams.get('status') || 'pending_review',
        q: url.searchParams.get('q') || '',
      });
    });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/resident-reports']}><ResidentReportsPage /></MemoryRouter>);

    expect(await screen.findByText('RPT-pending-reference-1')).toBeInTheDocument();
    expect(screen.getByText('Synthetic Reporter 1')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/resident-reports'), expect.any(Object)));
    expect(fetchMock.mock.calls[0][0]).toContain('page=1');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('RPT-pending-reference-2')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('page=2'))).toBe(true);
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approved' }));
    expect(await screen.findByText('RPT-approved-all-1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Approved' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('status=approved') && String(url).includes('page=1'))).toBe(true);

    await user.type(screen.getByRole('textbox', { name: 'Search reference or reporter name' }), 'RPT-filtered');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('RPT-approved-RPT-filtered-1')).toBeInTheDocument();
    expect(screen.getByText('Filtered RPT-filtered')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('status=approved') && String(url).includes('q=RPT-filtered') && String(url).includes('page=1'))).toBe(true);
  });
});
