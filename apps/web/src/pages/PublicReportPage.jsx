import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, ShieldCheck } from 'lucide-react';
import { ApiError, api } from '../api/client.js';
import { blankResidentReport, buildResidentReport, validateResidentReport } from '../features/reports/validation.js';
import { CATEGORY_OPTIONS, formatManilaDateTime } from '../utils/intake.js';
import { QRCodeCanvas } from 'qrcode.react';

function ReportField({ id, label, required, error, hint, children }) {
  return <div className={`field ${error ? 'field-invalid' : ''}`}><label htmlFor={id}>{label}{required && <span className="required-marker"> required</span>}</label>{hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}{children}{error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}</div>;
}

export function PublicReportPage() {
  const { slug = '' } = useParams();
  const [barangay, setBarangay] = useState(null);
  const [loadingBarangay, setLoadingBarangay] = useState(true);
  const [barangayError, setBarangayError] = useState('');
  const [values, setValues] = useState(blankResidentReport);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [ack, setAck] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api.publicGet(`/public/barangays/${encodeURIComponent(slug)}`).then((data) => { if (alive) setBarangay(data); }).catch((cause) => { if (alive) setBarangayError(cause.message); }).finally(() => { if (alive) setLoadingBarangay(false); });
    return () => { alive = false; };
  }, [slug]);

  const retryBarangay = () => {
    setLoadingBarangay(true);
    setBarangayError('');
    api.publicGet(`/public/barangays/${encodeURIComponent(slug)}`).then(setBarangay).catch((cause) => setBarangayError(cause.message)).finally(() => setLoadingBarangay(false));
  };
  const update = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const validation = validateResidentReport(values);
    setErrors(validation);
    setError('');
    if (Object.keys(validation).length) {
      document.getElementById(Object.keys(validation)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const result = await api.publicPost(`/public/barangays/${encodeURIComponent(slug)}/reports`, buildResidentReport(values));
      setAck(result);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) setErrors((current) => ({ ...current, ...cause.fields }));
      setError(cause.message);
      if (cause.fields && Object.keys(cause.fields).length) document.getElementById(Object.keys(cause.fields)[0])?.focus();
    } finally { setBusy(false); }
  };

  const reportUrl = barangay?.report_url || `${window.location.origin}/report/${encodeURIComponent(slug)}`;
  if (ack) return <main className="public-page"><header className="public-header"><Link className="wordmark" to={`/report/${encodeURIComponent(slug)}`}><span className="wordmark-mark">eB</span><span>eBarangay<span className="wordmark-soft">Mo</span></span></Link></header><section className="public-success"><span className="success-icon"><Check size={23} /></span><p className="greeting">Submission received</p><h1>Your report is with the barangay</h1><p>Your acknowledgement reference is:</p><strong className="ack-reference">{ack.reference}</strong><p className="small-note">Submitted {formatManilaDateTime(ack.submitted_at)} · Pending staff review</p><div className="notice notice-neutral"><ShieldCheck size={18} /><p>Keep this reference for your records. It is an acknowledgement only; it does not provide case lookup, confirm an official blotter, or request emergency help.</p></div><button className="button button-secondary" onClick={() => { setAck(null); setValues(blankResidentReport()); }}>Submit another report</button></section></main>;

  return <main className="public-page"><header className="public-header"><Link className="wordmark" to={`/report/${encodeURIComponent(slug)}`}><span className="wordmark-mark">eB</span><span>eBarangay<span className="wordmark-soft">Mo</span></span></Link><span className="public-tag">Community reporting</span></header><div className="public-content">
    <section className="public-intro"><p className="greeting">Barangay incident reporting</p><h1>Report an incident</h1><p>Send a report to the appropriate barangay for staff review.</p><div className="target-barangay">{loadingBarangay ? 'Loading barangay…' : barangayError ? 'Barangay unavailable' : <><span className="target-mark">{barangay?.code?.slice(0, 2) || 'BR'}</span><div><strong>{barangay?.name}</strong><span>{barangay?.city_name}</span></div></>}</div></section>
    {barangayError && <div className="notice notice-error" role="alert">{barangayError}<button className="button button-quiet" onClick={retryBarangay}>Try again</button></div>}
    <section className="public-form-card"><div className="public-card-heading"><div><h2>Incident details</h2><p>Required fields are marked. Share only what you know.</p></div></div>
      {error && <div className="notice notice-error" role="alert">{error}<span className="notice-detail">Your entries remain in this form. Review any marked fields or retry.</span></div>}
      <form onSubmit={submit} noValidate><div className="public-grid">
        <ReportField id="reporter_name" label="Your full name" required error={errors.reporter_name}><input id="reporter_name" name="reporter_name" autoComplete="name" maxLength={160} value={values.reporter_name} onChange={update} aria-invalid={Boolean(errors.reporter_name)} aria-describedby={errors.reporter_name ? 'reporter_name-error' : undefined} /></ReportField>
        <ReportField id="reporter_contact" label="Contact number" hint="Optional" error={errors.reporter_contact}><input id="reporter_contact" name="reporter_contact" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={values.reporter_contact} onChange={update} aria-invalid={Boolean(errors.reporter_contact)} aria-describedby={errors.reporter_contact ? 'reporter_contact-error' : undefined} /></ReportField>
        <ReportField id="incident_type" label="Incident category" required error={errors.incident_type}><select id="incident_type" name="incident_type" value={values.incident_type} onChange={update} aria-invalid={Boolean(errors.incident_type)}><option value="">Select a category</option>{CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></ReportField>
        <ReportField id="incident_datetime" label="Date and time" required hint="Philippine time (Asia/Manila)" error={errors.incident_datetime}><input id="incident_datetime" name="incident_datetime" type="datetime-local" value={values.incident_datetime} onChange={update} aria-invalid={Boolean(errors.incident_datetime)} /></ReportField>
        <ReportField id="sitio" label="Incident sitio / purok" required error={errors.sitio}><input id="sitio" name="sitio" maxLength={120} value={values.sitio} onChange={update} aria-invalid={Boolean(errors.sitio)} /></ReportField>
        <ReportField id="landmark" label="Landmark or street address" hint="Optional" error={errors.landmark}><input id="landmark" name="landmark" maxLength={255} value={values.landmark} onChange={update} aria-invalid={Boolean(errors.landmark)} /></ReportField>
        <ReportField id="respondent_name" label="Respondent name" hint="Optional; leave blank if unknown" error={errors.respondent_name}><input id="respondent_name" name="respondent_name" maxLength={160} value={values.respondent_name} onChange={update} aria-invalid={Boolean(errors.respondent_name)} /></ReportField>
        <ReportField id="narrative" label="What happened?" required error={errors.narrative}><textarea id="narrative" name="narrative" rows="6" maxLength={5000} value={values.narrative} onChange={update} aria-invalid={Boolean(errors.narrative)} aria-describedby={errors.narrative ? 'narrative-error' : 'narrative-count'} /><span id="narrative-count" className="field-hint count-hint">{values.narrative.length.toLocaleString()} / 5,000 characters</span></ReportField>
        <div className="honeypot" aria-hidden="true"><label htmlFor="website">Leave this field empty</label><input id="website" name="website" tabIndex="-1" autoComplete="off" value={values.website} onChange={update} /></div>
      </div><div className="privacy-note"><ShieldCheck size={17} /><p>Information is shared with authorized staff in this barangay for review. This form is <strong>not an emergency response channel</strong>. A submission is not automatic acceptance as an official blotter.</p></div><button className="button button-primary public-submit" type="submit" disabled={busy || loadingBarangay || Boolean(barangayError)}>{busy ? 'Sending report…' : 'Send report'}</button></form>
    </section>
    <section className="qr-panel"><div><h2>Share this barangay form</h2><p>The QR code opens this barangay’s public reporting link. No case lookup is available.</p><a href={reportUrl} className="text-link">{reportUrl}</a></div><div className="qr-code" aria-label="QR code for this barangay report form"><QRCodeCanvas value={reportUrl} size={116} includeMargin /></div></section>
  </div><footer className="public-footer">eBarangayMo · Reports are stored for authorized barangay staff review</footer></main>;
}
