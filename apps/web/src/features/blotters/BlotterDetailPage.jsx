import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, RotateCw } from 'lucide-react';
import { api } from '../../api/client.js';
import { formatManilaDateTime } from '../../utils/intake.js';
import { categoryLabel, statusLabel } from '../../utils/display.js';

const statuses = [
  { value: 'pending_lupon', label: 'Pending Lupon' },
  { value: 'settled_at_desk', label: 'Settled at Desk' },
  { value: 'referred_to_pnp', label: 'Referred to PNP' },
  { value: 'unresolved', label: 'Unresolved' },
];
function DetailLine({ label, children }) { return <div className="detail-line"><dt>{label}</dt><dd>{children || '—'}</dd></div>; }
export function BlotterDetailPage() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextStatus, setNextStatus] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusError, setStatusError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [data, history] = await Promise.all([api.get(`/blotters/${encodeURIComponent(id)}`), api.get(`/blotters/${encodeURIComponent(id)}/events`)]);
      setRecord(data);
      setEvents(Array.isArray(history) ? history : []);
      setNextStatus(data.status === 'draft' ? 'pending_lupon' : '');
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const updateStatus = async (event) => {
    event.preventDefault(); setStatusError(''); setFeedback('');
    if (!nextStatus) { setStatusError('Choose a new status.'); return; }
    if (!record) return;
    const reopening = ['settled_at_desk', 'referred_to_pnp', 'unresolved'].includes(record.status) && nextStatus === 'pending_lupon';
    if (reopening && !reason.trim()) { setStatusError('Enter a reason before reopening this record.'); return; }
    if (busy) return;
    setBusy(true);
    try {
      const updated = await api.patch(`/blotters/${encodeURIComponent(id)}/status`, { status: nextStatus, expected_version: record.version, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      setRecord(updated); setFeedback(`Status changed to ${statusLabel(updated.status)}.`); setReason('');
      const history = await api.get(`/blotters/${encodeURIComponent(id)}/events`); setEvents(Array.isArray(history) ? history : []);
    } catch (cause) {
      if (cause.status === 409) {
        setStatusError('This record changed since it was opened. The latest version is being reloaded.');
        try { await load(); } catch { /* load state supplies a separate visible error */ }
      } else setStatusError(cause.message);
    } finally { setBusy(false); }
  };
  if (loading) return <div className="page-wrap"><div className="table-loading" role="status">Loading record…</div></div>;
  if (error) return <div className="page-wrap"><Link className="back-link" to="/blotters"><ArrowLeft size={15} /> Blotter Records</Link><div className="notice notice-error" role="alert">{error}<button className="button button-quiet" onClick={load}><RotateCw size={15} /> Retry</button></div></div>;
  if (!record) return null;
  return <div className="page-wrap detail-wrap">
    <Link className="back-link" to="/blotters"><ArrowLeft size={15} /> Blotter Records</Link>
    <header className="detail-heading"><div><p className="greeting">{record.source === 'resident_report' ? 'Converted resident report' : 'Walk-in incident'}</p><h1 className="detail-case-id">{record.case_id}</h1><span className={`status-badge status-${record.status}`}><i aria-hidden="true" />{statusLabel(record.status)}</span></div><span className="version-note">Record version {record.version}</span></header>
    <div className="detail-layout"><div className="detail-main">
      <section className="detail-section"><div className="detail-section-title"><h2>Incident</h2><span>{categoryLabel(record.incident_type)}</span></div><dl className="detail-grid"><DetailLine label="Date and time">{formatManilaDateTime(record.incident_datetime)}</DetailLine><DetailLine label="Incident sitio / purok">{record.sitio}</DetailLine><DetailLine label="Landmark or street address">{record.landmark}</DetailLine><DetailLine label="Initial status">{statusLabel(record.status)}</DetailLine></dl><div className="narrative-block"><h3>Incident narrative and initial actions</h3><p>{record.narrative}</p></div></section>
      <section className="detail-section"><div className="detail-section-title"><h2>Complainant</h2></div><dl className="detail-grid"><DetailLine label="Full name">{record.complainant_name}</DetailLine><DetailLine label="Contact number">{record.complainant_contact}</DetailLine><DetailLine label="Home sitio / purok">{record.complainant_sitio}</DetailLine><DetailLine label="Residency status">{record.complainant_resident_status?.replace('_', ' ')}</DetailLine></dl></section>
      <section className="detail-section"><div className="detail-section-title"><h2>Respondent</h2><span>{record.respondent_unknown ? 'Unknown' : ''}</span></div><dl className="detail-grid"><DetailLine label="Full name">{record.respondent_unknown ? 'Unknown' : record.respondent_name}</DetailLine><DetailLine label="Contact number">{record.respondent_unknown ? 'Unknown' : record.respondent_contact}</DetailLine><DetailLine label="Home sitio / purok">{record.respondent_unknown ? 'Unknown' : record.respondent_sitio}</DetailLine><DetailLine label="Residency status">{record.respondent_resident_status?.replace('_', ' ')}</DetailLine></dl></section>
      <section className="detail-section"><div className="detail-section-title"><h2>Record history</h2><span>{events.length} {events.length === 1 ? 'event' : 'events'}</span></div>{events.length ? <ol className="event-list">{events.map((event) => <li key={event.id}><span className="event-mark" aria-hidden="true"><Clock3 size={13} /></span><div><strong>{event.event_type === 'status_changed' ? `${statusLabel(event.from_status)} → ${statusLabel(event.to_status)}` : event.event_type?.replaceAll('_', ' ') || 'Record created'}</strong><span>{event.actor_name || 'Staff'} · {formatManilaDateTime(event.created_at)}</span>{event.reason && <p>{event.reason}</p>}</div></li>)}</ol> : <p className="muted-copy">No history is available for this record.</p>}</section>
    </div><aside className="detail-aside"><section className="audit-panel"><h2>Record details</h2><dl><DetailLine label="Created by">{record.creator_name}</DetailLine><DetailLine label="Created on">{formatManilaDateTime(record.created_at)}</DetailLine><DetailLine label="Submitted on">{formatManilaDateTime(record.submitted_at)}</DetailLine><DetailLine label="Updated on">{formatManilaDateTime(record.updated_at)}</DetailLine></dl><p className="immutable-note">Case number and creation details are permanent.</p></section>
      <section className="status-panel"><h2>Update status</h2>{feedback && <p className="success-inline" role="status"><Check size={15} /> {feedback}</p>}{statusError && <p className="field-error status-error" role="alert">{statusError}</p>}<form onSubmit={updateStatus}><label className="compact-field"><span>New status</span><select aria-label="New status" value={nextStatus} onChange={(event) => { setNextStatus(event.target.value); setStatusError(''); }}>{record.status !== 'draft' && <option value="">Choose status</option>}{statuses.filter((option) => option.value !== record.status).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><label className="compact-field status-reason"><span>Reason <em>Required to reopen</em></span><textarea rows="3" maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain this change" /></label><button className="button button-primary button-wide" disabled={busy}>{busy ? 'Updating…' : 'Update status'}</button></form><p className="small-note">Every update records the staff member, time, and previous status.</p></section></aside></div>
  </div>;
}
