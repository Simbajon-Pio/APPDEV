import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, RotateCw, ShieldCheck } from 'lucide-react';
import { api } from '../../api/client.js';
import { INITIAL_STATUS_OPTIONS, formatManilaDateTime } from '../../utils/intake.js';
import { categoryLabel, statusLabel } from '../../utils/display.js';

function display(value) { return value || 'Not provided'; }

export function ResidentReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [initialStatus, setInitialStatus] = useState('pending_lupon');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reviewConflict, setReviewConflict] = useState('');
  const [convertedCase, setConvertedCase] = useState(null);
  const [conversionCreated, setConversionCreated] = useState(false);

  const load = useCallback(async ({ preserveFeedback = false, preserveError = false, preserveConflict = false } = {}) => {
    setLoading(true);
    if (!preserveError) setError('');
    if (!preserveFeedback) setFeedback('');
    if (!preserveConflict) setReviewConflict('');
    try {
      const data = await api.get(`/resident-reports/${encodeURIComponent(id)}`);
      setReport(data);
      setReason(data.rejection_reason || '');
      setInitialStatus('pending_lupon');
      setConvertedCase(data.blotter_id ? { id: data.blotter_id, case_id: data.case_id } : null);
      setConversionCreated(false);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const approvalIntake = () => {
    const original = report.original;
    return {
      incident_type: original.incident_type,
      incident_datetime: original.incident_datetime,
      sitio: original.sitio,
      landmark: original.landmark,
      complainant_name: original.reporter_name,
      complainant_contact: original.reporter_contact,
      complainant_sitio: null,
      complainant_resident_status: 'unknown',
      respondent_unknown: !original.respondent_name,
      respondent_name: original.respondent_name,
      respondent_contact: null,
      respondent_sitio: null,
      respondent_resident_status: 'unknown',
      narrative: original.narrative,
      status: initialStatus,
    };
  };

  const approve = async () => {
    if (busy || report?.status !== 'pending_review') return;
    setBusy(true);
    setError(''); setFeedback(''); setReviewConflict('');
    try {
      const { data, status: responseStatus } = await api.postWithStatus(`/resident-reports/${encodeURIComponent(id)}/approve`, { intake: approvalIntake() });
      setReport(data.report);
      setConvertedCase(data.blotter);
      const created = responseStatus === 201;
      setConversionCreated(created);
      setFeedback(created ? 'Report approved and linked to its official case.' : 'Report was already approved; the existing official case remains linked.');
    } catch (cause) {
      if (cause.status === 409) {
        setReviewConflict('This report was reviewed elsewhere. The latest state has been reloaded.');
        await load({ preserveFeedback: true, preserveError: true, preserveConflict: true });
      } else setError(cause.message);
    } finally { setBusy(false); }
  };

  const reject = async () => {
    if (busy || report?.status !== 'pending_review') return;
    if (!reason.trim() || reason.trim().length > 1000) { setError('Enter a rejection reason between 1 and 1,000 characters.'); return; }
    setBusy(true); setError(''); setFeedback(''); setReviewConflict('');
    try {
      const updated = await api.post(`/resident-reports/${encodeURIComponent(id)}/reject`, { reason: reason.trim() });
      setReport(updated);
      setFeedback('Report rejected. The original submission remains on record.');
    } catch (cause) {
      if (cause.status === 409) {
        setReviewConflict('This report was reviewed elsewhere. The latest state has been reloaded.');
        await load({ preserveFeedback: true, preserveError: true, preserveConflict: true });
      } else setError(cause.message);
    } finally { setBusy(false); }
  };

  if (loading) return <div className="page-wrap"><div className="table-loading" role="status">Loading resident report…</div></div>;
  if (error && !report) return <div className="page-wrap"><Link className="back-link" to="/resident-reports"><ArrowLeft size={15} /> Resident Reports</Link><div className="notice notice-error" role="alert">{error}<button className="button button-quiet" onClick={load}><RotateCw size={15} /> Retry</button></div></div>;
  if (!report) return null;
  const original = report.original;
  const editable = report.status === 'pending_review';

  return <div className="page-wrap detail-wrap">
    <Link className="back-link" to="/resident-reports"><ArrowLeft size={15} /> Resident Reports</Link>
    <header className="detail-heading"><div><p className="greeting">Original resident submission</p><h1 className="detail-case-id report-reference">{report.reference}</h1><span className={`status-badge status-${report.status}`}><i aria-hidden="true" />{statusLabel(report.status)}</span></div><span className="version-note">Submitted {formatManilaDateTime(report.submitted_at)}</span></header>
    {reviewConflict && <div className="notice notice-error" role="alert">{reviewConflict}</div>}
    {error && !reviewConflict && <div className="notice notice-error" role="alert">{error}{report.status !== 'pending_review' && <button className="button button-quiet" onClick={load}><RotateCw size={15} /> Refresh</button>}</div>}
    {feedback && <div className="notice notice-success" role="status"><Check size={16} /> {feedback}</div>}
    {convertedCase && <div className="notice notice-success">{conversionCreated ? 'Official case created: ' : 'Existing official case: '}<Link className="case-id" to={`/blotters/${convertedCase.id}`}>{convertedCase.case_id || report.case_id}</Link></div>}
    <div className="review-layout"><div className="detail-main">
      <section className="detail-section"><div className="detail-section-title"><h2>Original report</h2><span>Submitted values · read-only</span></div><dl className="detail-grid"><div className="detail-line"><dt>Reporter</dt><dd>{display(original.reporter_name)}</dd></div><div className="detail-line"><dt>Contact</dt><dd>{display(original.reporter_contact)}</dd></div><div className="detail-line"><dt>Category</dt><dd>{categoryLabel(original.incident_type)}</dd></div><div className="detail-line"><dt>Incident time</dt><dd>{formatManilaDateTime(original.incident_datetime)}</dd></div><div className="detail-line"><dt>Sitio / purok</dt><dd>{display(original.sitio)}</dd></div><div className="detail-line"><dt>Landmark</dt><dd>{display(original.landmark)}</dd></div><div className="detail-line"><dt>Known respondent</dt><dd>{display(original.respondent_name)}</dd></div></dl><div className="narrative-block"><h3>Original narrative</h3><p>{display(original.narrative)}</p></div></section>
      {report.rejection_reason && <section className="detail-section"><h2>Rejection reason</h2><p className="narrative-copy">{report.rejection_reason}</p><p className="small-note">Reviewed by {report.reviewer_name || 'staff'} · {formatManilaDateTime(report.reviewed_at)}</p></section>}
      {editable && <section className="detail-section"><div className="detail-section-title"><h2>Confirm official intake</h2><span>Separate from original</span></div><p className="muted-copy">Sprint 2 approval preserves submitted facts exactly. Contacts, home locations, and residency not included in the original report remain unknown.</p><p className="immutable-note"><ShieldCheck size={15} /> To correct a fact, keep this report pending and use an authorized separate correction process.</p><label className="compact-field" htmlFor="approval-status"><span>Initial case status</span><select id="approval-status" value={initialStatus} onChange={(event) => setInitialStatus(event.target.value)}>{INITIAL_STATUS_OPTIONS.filter((option) => option.value !== 'draft').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="review-actions"><button className="button button-primary" type="button" disabled={busy} onClick={approve}>{busy ? 'Approving…' : 'Approve and create blotter'}</button></div><div className="reject-panel"><h3>Reject this report</h3><label className="compact-field" htmlFor="rejection_reason"><span>Reason · required</span><textarea id="rejection_reason" rows="3" maxLength={1000} value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} /></label><button className="button button-danger" type="button" disabled={busy} onClick={reject}>{busy ? 'Saving…' : 'Reject report'}</button></div></section>}
      {!editable && <section className="detail-section reviewed-panel"><h2>Review complete</h2><p>This original report is {statusLabel(report.status).toLowerCase()} and cannot be reviewed again.</p><p className="small-note">Reviewed by {report.reviewer_name || 'staff'} · {formatManilaDateTime(report.reviewed_at)}</p>{convertedCase && <button className="button button-primary" onClick={() => navigate(`/blotters/${convertedCase.id}`)}>Open official blotter</button>}</section>}
    </div><aside className="detail-aside"><section className="audit-panel"><h2>Submission details</h2><dl><div className="detail-line"><dt>Reference</dt><dd className="case-id">{report.reference}</dd></div><div className="detail-line"><dt>Status</dt><dd><span className={`status-badge status-${report.status}`}><i aria-hidden="true" />{statusLabel(report.status)}</span></dd></div><div className="detail-line"><dt>Submitted</dt><dd>{formatManilaDateTime(report.submitted_at)}</dd></div><div className="detail-line"><dt>Reviewed</dt><dd>{formatManilaDateTime(report.reviewed_at)}</dd></div></dl><p className="immutable-note"><ShieldCheck size={15} /> Original values are preserved separately from the confirmed intake.</p></section></aside></div>
  </div>;
}
