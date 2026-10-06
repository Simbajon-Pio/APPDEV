import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { BlotterDetailPage } from '../src/features/blotters/BlotterDetailPage.jsx';
import { BlotterFormPage } from '../src/features/blotters/BlotterFormPage.jsx';
import { ResidentReportDetailPage } from '../src/features/reports/ResidentReportDetailPage.jsx';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const pendingReport = {
  id: 12,
  reference: 'RPT-demo-reference',
  status: 'pending_review',
  submitted_at: '2026-10-06T12:30:00.000Z',
  original: { reporter_name: 'Synthetic Reporter', reporter_contact: '123456789', incident_type: 'others', incident_datetime: '2020-10-06T12:30:45.000Z', sitio: 'Demo Purok 1', narrative: 'Synthetic incident narrative.', respondent_name: 'Synthetic Respondent' },
};
const approvedReport = { ...pendingReport, status: 'approved', reviewed_at: '2026-10-06T12:40:00.000Z', reviewed_by: 3, reviewer_name: 'Synthetic Officer', blotter_id: 33, case_id: 'BLOT-DEMO-2026-00033' };
const blotter = { id: 33, case_id: 'BLOT-DEMO-2026-00033' };
function renderReview() {
  return render(<MemoryRouter initialEntries={['/resident-reports/12']}><Routes><Route path="/resident-reports/:id" element={<ResidentReportDetailPage />} /></Routes></MemoryRouter>);
}

describe('blotter intake respondent fields', () => {
  it('clears respondent facts when changing the known state to unknown', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { id: 9, case_id: 'BLOT-DEMO-2020-00001', status: 'draft', complainant_name: 'Synthetic Complainant', sitio: 'Demo Purok 1' } }), { status: 201 }));
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/blotters/new']}><Routes><Route path="/blotters/new" element={<BlotterFormPage />} /></Routes></MemoryRouter>);
    await user.selectOptions(screen.getByRole('combobox', { name: /incident category/i }), 'others');
    await user.type(document.getElementById('incident_datetime'), '2020-10-06T20:30');
    await user.type(screen.getByRole('textbox', { name: /incident sitio \/ purok/i }), 'Demo Purok 1');
    await user.type(document.getElementById('complainant_name'), 'Synthetic Complainant');
    await user.type(screen.getByRole('textbox', { name: /incident narrative and initial actions/i }), 'Synthetic details for testing.');
    await user.click(screen.getByRole('radio', { name: 'Yes, details are known' }));
    await user.type(document.getElementById('respondent_name'), 'Synthetic Respondent');
    await user.type(document.getElementById('respondent_contact'), '09123456789');
    await user.type(document.getElementById('respondent_sitio'), 'Other Purok');
    await user.selectOptions(document.getElementById('respondent_resident_status'), 'resident');
    await user.click(screen.getByLabelText('Unknown'));
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    expect(await screen.findByRole('heading', { name: 'BLOT-DEMO-2020-00001' })).toBeInTheDocument();
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ respondent_unknown: true, respondent_name: null, respondent_contact: null, respondent_sitio: null, respondent_resident_status: 'unknown', status: 'draft' });
  });
});

describe('blotter event history', () => {
  it('renders status_changed events as from-to transitions', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/events')) return new Response(JSON.stringify({ data: [{ id: 21, event_type: 'status_changed', actor_name: 'Synthetic Officer', from_status: 'pending_lupon', to_status: 'settled_at_desk', created_at: '2026-10-06T12:30:00.000Z', reason: 'Synthetic resolution' }] }), { status: 200 });
      return new Response(JSON.stringify({ data: { id: 9, case_id: 'BLOT-DEMO-2026-00001', status: 'settled_at_desk', version: 2, source: 'walk_in', incident_type: 'others', incident_datetime: '2026-10-06T12:30:00.000Z', sitio: 'Demo Purok 1', complainant_name: 'Synthetic Complainant', complainant_resident_status: 'unknown', respondent_unknown: true, respondent_resident_status: 'unknown', narrative: 'Synthetic details', creator_name: 'Synthetic Officer', created_at: '2026-10-06T12:30:00.000Z', submitted_at: '2026-10-06T12:30:00.000Z', updated_at: '2026-10-06T12:30:00.000Z' } }), { status: 200 });
    });
    render(<MemoryRouter initialEntries={['/blotters/9']}><Routes><Route path="/blotters/:id" element={<BlotterDetailPage />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Pending Lupon → Settled at Desk')).toBeInTheDocument());
    expect(screen.getByText('Synthetic Officer · Oct 6, 2026, 8:30 PM')).toBeInTheDocument();
    expect(screen.getByText('Synthetic resolution')).toBeInTheDocument();
  });
});

describe('resident report review retries', () => {
  it('sends exact original facts and labels first and repeated approvals correctly', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: pendingReport }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { report: approvedReport, blotter } }), { status: 201 }));
    const user = userEvent.setup();
    renderReview();
    await user.click(await screen.findByRole('button', { name: /approve and create blotter/i }));
    expect(await screen.findByText('Report approved and linked to its official case.')).toBeInTheDocument();
    expect(screen.getByText(/Official case created:/)).toBeInTheDocument();
    const submitted = JSON.parse(fetchMock.mock.calls[1][1].body).intake;
    expect(submitted).toMatchObject({ complainant_name: pendingReport.original.reporter_name, complainant_contact: pendingReport.original.reporter_contact, respondent_name: pendingReport.original.respondent_name, respondent_unknown: false, incident_datetime: pendingReport.original.incident_datetime, complainant_sitio: null, respondent_contact: null, respondent_sitio: null, complainant_resident_status: 'unknown', respondent_resident_status: 'unknown' });
  });

  it('labels an idempotent approval as the existing case', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: pendingReport }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { report: approvedReport, blotter } }), { status: 200 }));
    renderReview();
    await userEvent.click(await screen.findByRole('button', { name: /approve and create blotter/i }));
    expect(await screen.findByText('Report was already approved; the existing official case remains linked.')).toBeInTheDocument();
    expect(screen.getByText(/Existing official case:/)).toBeInTheDocument();
    expect(screen.queryByText(/^Official case created:/)).not.toBeInTheDocument();
  });

  it('keeps the conflict notice visible when the latest review state reloads', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: pendingReport }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'CONFLICT', message: 'This report was reviewed elsewhere.' } }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: approvedReport }), { status: 200 }));
    renderReview();
    await userEvent.click(await screen.findByRole('button', { name: /approve and create blotter/i }));
    expect(screen.getByRole('alert').textContent).toContain('This report was reviewed elsewhere. The latest state has been reloaded.');
    expect(screen.getByText(/Existing official case:/)).toBeInTheDocument();
    expect(screen.getByText(/approved and cannot be reviewed again/i)).toBeInTheDocument();
  });
});
