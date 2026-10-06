import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, RotateCw, ShieldCheck } from 'lucide-react';
import { ApiError, api } from '../../api/client.js';
import { CATEGORY_OPTIONS, INITIAL_STATUS_OPTIONS, RESIDENCY_OPTIONS, formatManilaDateTime, fromManilaTimestamp, toManilaTimestamp } from '../../utils/intake.js';
import { categoryLabel, statusLabel } from '../../utils/display.js';

function reviewValues(report) {
  const original = report.original || {};
  const unknown = !original.respondent_name;
  return {
    incident_type: original.incident_type || '',
    incident_datetime: fromManilaTimestamp(original.incident_datetime),
    sitio: original.sitio || '',
    landmark: original.landmark || '',
    complainant_name: original.reporter_name || '',
    complainant_contact: original.reporter_contact || '',
    complainant_sitio: '',
    complainant_resident_status: 'unknown',
    respondent_unknown: unknown,
    respondent_name: original.respondent_name || '',
    respondent_contact: '',
    respondent_sitio: '',
    respondent_resident_status: 'unknown',
    narrative: original.narrative || '',
    status: 'pending_lupon',
  };
}

function validateReview(values) {
  const errors = {};
  if (!values.incident_type) errors.incident_type = 'Choose an incident category.';
  if (!values.incident_datetime || !toManilaTimestamp(values.incident_datetime)) errors.incident_datetime = 'Enter a valid Philippine date and time.';
  else if (new Date(toManilaTimestamp(values.incident_datetime)) > new Date()) errors.incident_datetime = 'Incident time cannot be in the future.';
  if (!values.sitio.trim() || values.sitio.trim().length > 120) errors.sitio = 'Enter a sitio or purok (120 characters or fewer).';
  if (values.landmark.trim().length > 255) errors.landmark = 'Use 255 characters or fewer.';
  if (!values.complainant_name.trim() || values.complainant_name.trim().length > 160) errors.complainant_name = 'Enter a name (160 characters or fewer).';
  if (!values.complainant_contact.trim()) values.complainant_contact = '';
  if (values.complainant_contact && (!/^[\d +()\-]{7,20}$/.test(values.complainant_contact.trim()) || (values.complainant_contact.match(/\d/g) || []).length < 7)) errors.complainant_contact = 'Use a valid contact with at least seven digits.';
  if (!RESIDENCY_OPTIONS.some(({ value }) => value === values.complainant_resident_status)) errors.complainant_resident_status = 'Choose a residency status.';
  if (values.respondent_unknown) {
    values.respondent_name = '';
    values.respondent_contact = '';
    values.respondent_sitio = '';
    values.respondent_resident_status = 'unknown';
  } else {
    if (!values.respondent_name.trim() || values.respondent_name.trim().length > 160) errors.respondent_name = 'Enter a name or mark respondent unknown.';
    if (values.respondent_contact && (!/^[\d +()\-]{7,20}$/.test(values.respondent_contact.trim()) || (values.respondent_contact.match(/\d/g) || []).length < 7)) errors.respondent_contact = 'Use a valid contact with at least seven digits.';
    if (values.respondent_sitio.trim().length > 120) errors.respondent_sitio = 'Use 120 characters or fewer.';
    if (!RESIDENCY_OPTIONS.some(({ value }) => value === values.respondent_resident_status)) errors.respondent_resident_status = 'Choose a residency status.';
  }
  if (!values.narrative.trim() || values.narrative.trim().length > 5000) errors.narrative = 'Enter a narrative (5,000 characters or fewer).';
  if (!INITIAL_STATUS_OPTIONS.some(({ value }) => value === values.status) || values.status === 'draft') errors.status = 'Choose a non-draft initial status.';
  return errors;
}

function Field({ id, label, error, children }) {
  return <div className={`field ${error ? 'field-invalid' : ''}`}><label htmlFor={id}>{label}</label>{children}{error && <span id={`${id}-error`} className="field-error" role="alert">{error}</span>}</div>;
}
function display(value) { return value || 'Not provided'; }

export function ResidentReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [values, setValues] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [convertedCase, setConvertedCase] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await api.get(`/resident-reports/${encodeURIComponent(id)}`);
      setReport(data);
      setValues(reviewValues(data));
      setReason(data.rejection_reason || '');
      if (data.blotter_id) setConvertedCase({ id: data.blotter_id, case_id: data.case_id });
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const update = (event) => {
    const { name, value } = event.target;
    const nextValue = name === 'respondent_unknown' ? value === 'yes' : value;
    setValues((current) => ({ ...current, [name]: nextValue }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
    setFeedback('');
  };
  const approve = async (event) => {
    event.preventDefault();
    if (busy || report?.status !== 'pending_review') return;
    const errors = validateReview({ ...values });
    setFieldErrors(errors);
    setError(''); setFeedback('');
    if (Object.keys(errors).length) {
      document.getElementById(Object.keys(errors)[0])?.focus();
      return;
    }
    setBusy(true);
    const intake = {
      ...values,
      incident_datetime: toManilaTimestamp(values.incident_datetime),
      sitio: values.sitio.trim(), landmark: values.landmark.trim() || null,
      complainant_name: values.complainant_name.trim(), complainant_contact: values.complainant_contact.trim() || null,
      complainant_sitio: values.complainant_sitio.trim() || null,
      respondent_name: values.respondent_unknown ? null : values.respondent_name.trim(),
      respondent_contact: values.respondent_unknown ? null : values.respondent_contact.trim() || null,
      respondent_sitio: values.respondent_unknown ? null : values.respondent_sitio.trim() || null,
      narrative: values.narrative.trim(),
    };
    try {
      const result = await api.post(`/resident-reports/${encodeURIComponent(id)}/approve`, { intake });
      setReport(result.report);
      setConvertedCase(result.blotter);
      setFeedback('Report approved and linked to its official case.');
    } catch (cause) {
      if (cause.status === 409) {
        setError('This report was reviewed elsewhere. The latest state has been reloaded.');
        await load();
      } else {
        if (cause instanceof ApiError && cause.status === 422) setFieldErrors((current) => ({ ...current, ...cause.fields }));
        setError(cause.message);
      }
    } finally { setBusy(false); }
  };
  const reject = async () => {
    if (busy || report?.status !== 'pending_review') return;
    if (!reason.trim() || reason.trim().length > 1000) { setError('Enter a rejection reason between 1 and 1,000 characters.'); return; }
    setBusy(true); setError(''); setFeedback('');
    try {
      const updated = await api.post(`/resident-reports/${encodeURIComponent(id)}/reject`, { reason: reason.trim() });
      setReport(updated);
      setFeedback('Report rejected. The original submission remains on record.');
    } catch (cause) {
      if (cause.status === 409) {
        setError('This report was reviewed elsewhere. The latest state has been reloaded.');
        await load();
      } else setError(cause.message);
    } finally { setBusy(false); }
  };

  if (loading) return <div className="page-wrap"><div className="table-loading" role="status">Loading resident report…</div></div>;
  if (error && !report) return <div className="page-wrap"><Link className="back-link" to="/resident-reports"><ArrowLeft size={15} /> Resident Reports</Link><div className="notice notice-error" role="alert">{error}<button className="button button-quiet" onClick={load}><RotateCw size={15} /> Retry</button></div></div>;
  if (!report || !values) return null;
  const original = report.original || {};
  const editable = report.status === 'pending_review';

  return <div className="page-wrap detail-wrap">
    <Link className="back-link" to="/resident-reports"><ArrowLeft size={15} /> Resident Reports</Link>
    <header className="detail-heading"><div><p className="greeting">Original resident submission</p><h1 className="detail-case-id report-reference">{report.reference}</h1><span className={`status-badge status-${report.status}`}><i aria-hidden="true" />{statusLabel(report.status)}</span></div><span className="version-note">Submitted {formatManilaDateTime(report.submitted_at)}</span></header>
    {error && <div className="notice notice-error" role="alert">{error}{report.status !== 'pending_review' && <button className="button button-quiet" onClick={load}><RotateCw size={15} /> Refresh</button>}</div>}
    {feedback && <div className="notice notice-success" role="status"><Check size={16} /> {feedback}</div>}
    {convertedCase && <div className="notice notice-success">Official case created: <Link className="case-id" to={`/blotters/${convertedCase.id}`}>{convertedCase.case_id || report.case_id}</Link></div>}
    <div className="review-layout"><div className="detail-main">
      <section className="detail-section"><div className="detail-section-title"><h2>Original report</h2><span>Submitted values · read-only</span></div><dl className="detail-grid"><div className="detail-line"><dt>Reporter</dt><dd>{display(original.reporter_name)}</dd></div><div className="detail-line"><dt>Contact</dt><dd>{display(original.reporter_contact)}</dd></div><div className="detail-line"><dt>Category</dt><dd>{categoryLabel(original.incident_type)}</dd></div><div className="detail-line"><dt>Incident time</dt><dd>{formatManilaDateTime(original.incident_datetime)}</dd></div><div className="detail-line"><dt>Sitio / purok</dt><dd>{display(original.sitio)}</dd></div><div className="detail-line"><dt>Landmark</dt><dd>{display(original.landmark)}</dd></div><div className="detail-line"><dt>Known respondent</dt><dd>{display(original.respondent_name)}</dd></div></dl><div className="narrative-block"><h3>Original narrative</h3><p>{display(original.narrative)}</p></div></section>
      {report.rejection_reason && <section className="detail-section"><h2>Rejection reason</h2><p className="narrative-copy">{report.rejection_reason}</p><p className="small-note">Reviewed by {report.reviewer_name || 'staff'} · {formatManilaDateTime(report.reviewed_at)}</p></section>}
      {editable && <section className="detail-section"><div className="detail-section-title"><h2>Confirm official intake</h2><span>Separate from original</span></div><p className="muted-copy">Review each value. Unknown details stay unknown; do not add unverified contacts or addresses.</p>
        <form className="intake-form review-form" onSubmit={approve} noValidate>
          <div className="form-section"><h3>Incident and location</h3><div className="form-grid"><Field id="incident_type" label="Incident category" error={fieldErrors.incident_type}><select id="incident_type" name="incident_type" value={values.incident_type} onChange={update} aria-invalid={Boolean(fieldErrors.incident_type)}><option value="">Select a category</option>{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field><Field id="incident_datetime" label="Date and time · Philippine time" error={fieldErrors.incident_datetime}><input id="incident_datetime" name="incident_datetime" type="datetime-local" value={values.incident_datetime} onChange={update} aria-invalid={Boolean(fieldErrors.incident_datetime)} /></Field><Field id="sitio" label="Incident sitio / purok" error={fieldErrors.sitio}><input id="sitio" name="sitio" maxLength={120} value={values.sitio} onChange={update} aria-invalid={Boolean(fieldErrors.sitio)} /></Field><Field id="landmark" label="Landmark or street address" error={fieldErrors.landmark}><input id="landmark" name="landmark" maxLength={255} value={values.landmark} onChange={update} aria-invalid={Boolean(fieldErrors.landmark)} /></Field></div></div>
          <div className="form-section"><h3>Complainant</h3><div className="form-grid"><Field id="complainant_name" label="Full name" error={fieldErrors.complainant_name}><input id="complainant_name" name="complainant_name" maxLength={160} value={values.complainant_name} onChange={update} aria-invalid={Boolean(fieldErrors.complainant_name)} /></Field><Field id="complainant_contact" label="Contact · optional" error={fieldErrors.complainant_contact}><input id="complainant_contact" name="complainant_contact" type="tel" maxLength={20} value={values.complainant_contact} onChange={update} aria-invalid={Boolean(fieldErrors.complainant_contact)} /></Field><Field id="complainant_sitio" label="Home sitio / purok · optional" error={fieldErrors.complainant_sitio}><input id="complainant_sitio" name="complainant_sitio" maxLength={120} value={values.complainant_sitio} onChange={update} aria-invalid={Boolean(fieldErrors.complainant_sitio)} /></Field><Field id="complainant_resident_status" label="Residency status" error={fieldErrors.complainant_resident_status}><select id="complainant_resident_status" name="complainant_resident_status" value={values.complainant_resident_status} onChange={update}>{RESIDENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field></div></div>
          <div className="form-section"><h3>Respondent</h3><fieldset className="choice-fieldset"><legend>Do you know the respondent?</legend><div className="choice-row"><label className="choice-option"><input type="radio" name="respondent_unknown" value="yes" checked={!values.respondent_unknown} onChange={update} /><span>Yes, details are known</span></label><label className="choice-option"><input type="radio" name="respondent_unknown" value="no" checked={values.respondent_unknown} onChange={update} /><span>Unknown</span></label></div></fieldset>{!values.respondent_unknown ? <div className="form-grid"><Field id="respondent_name" label="Full name" error={fieldErrors.respondent_name}><input id="respondent_name" name="respondent_name" maxLength={160} value={values.respondent_name} onChange={update} aria-invalid={Boolean(fieldErrors.respondent_name)} /></Field><Field id="respondent_contact" label="Contact · optional" error={fieldErrors.respondent_contact}><input id="respondent_contact" name="respondent_contact" type="tel" maxLength={20} value={values.respondent_contact} onChange={update} aria-invalid={Boolean(fieldErrors.respondent_contact)} /></Field><Field id="respondent_sitio" label="Home sitio / purok · optional" error={fieldErrors.respondent_sitio}><input id="respondent_sitio" name="respondent_sitio" maxLength={120} value={values.respondent_sitio} onChange={update} aria-invalid={Boolean(fieldErrors.respondent_sitio)} /></Field><Field id="respondent_resident_status" label="Residency status" error={fieldErrors.respondent_resident_status}><select id="respondent_resident_status" name="respondent_resident_status" value={values.respondent_resident_status} onChange={update}>{RESIDENCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field></div> : <p className="unknown-note">Name, contact, home location, and residency stay unknown.</p>}</div>
          <div className="form-section"><h3>Narrative and initial status</h3><div className="form-grid"><Field id="narrative" label="Incident narrative and initial actions" error={fieldErrors.narrative}><textarea id="narrative" name="narrative" rows="5" maxLength={5000} value={values.narrative} onChange={update} aria-invalid={Boolean(fieldErrors.narrative)} /></Field><Field id="status" label="Initial non-draft status" error={fieldErrors.status}><select id="status" name="status" value={values.status} onChange={update}>{INITIAL_STATUS_OPTIONS.filter((option) => option.value !== 'draft').map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field></div></div>
          <div className="review-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Approving…' : 'Approve and create blotter'}</button></div>
        </form>
        <div className="reject-panel"><h3>Reject this report</h3><label className="compact-field" htmlFor="rejection_reason"><span>Reason · required</span><textarea id="rejection_reason" rows="3" maxLength={1000} value={reason} onChange={(event) => { setReason(event.target.value); setError(''); }} /></label><button className="button button-danger" type="button" disabled={busy} onClick={reject}>{busy ? 'Saving…' : 'Reject report'}</button></div>
      </section>}
      {!editable && <section className="detail-section reviewed-panel"><h2>Review complete</h2><p>This original report is {statusLabel(report.status).toLowerCase()} and cannot be reviewed again.</p><p className="small-note">Reviewed by {report.reviewer_name || 'staff'} · {formatManilaDateTime(report.reviewed_at)}</p>{convertedCase && <button className="button button-primary" onClick={() => navigate(`/blotters/${convertedCase.id}`)}>Open official blotter</button>}</section>}
    </div><aside className="detail-aside"><section className="audit-panel"><h2>Submission details</h2><dl><div className="detail-line"><dt>Reference</dt><dd className="case-id">{report.reference}</dd></div><div className="detail-line"><dt>Status</dt><dd><span className={`status-badge status-${report.status}`}><i aria-hidden="true" />{statusLabel(report.status)}</span></dd></div><div className="detail-line"><dt>Submitted</dt><dd>{formatManilaDateTime(report.submitted_at)}</dd></div><div className="detail-line"><dt>Reviewed</dt><dd>{formatManilaDateTime(report.reviewed_at)}</dd></div></dl><p className="immutable-note"><ShieldCheck size={15} /> Original values are preserved separately from the confirmed intake.</p></section></aside></div>
  </div>;
}
