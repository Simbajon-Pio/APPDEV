import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../../api/client.js';
import { CATEGORY_OPTIONS, INITIAL_STATUS_OPTIONS, RESIDENCY_OPTIONS, blankIntake, buildIntake, validateIntake } from '../../utils/intake.js';

function Field({ id, label, required, hint, error, children }) {
  return <div className={`field ${error ? 'field-invalid' : ''}`}><label htmlFor={id}>{label}{required && <span className="required-marker"> required</span>}</label>{hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}{children}{error && <span className="field-error" id={`${id}-error`} role="alert"><CircleAlert size={13} />{error}</span>}</div>;
}
function TextInput({ id, value, onChange, type = 'text', maxLength, required, hint, error, ...props }) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined;
  return <input id={id} type={type} value={value} onChange={onChange} maxLength={maxLength} required={required} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />;
}
export function BlotterFormPage() {
  const [values, setValues] = useState(blankIntake);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(null);
  const navigate = useNavigate();
  const set = (name) => (event) => {
    const value = name === 'respondent_unknown' ? event.target.value === 'no' : event.target.value;
    if (name === 'respondent_unknown' && value) {
      setValues((current) => ({ ...current, respondent_unknown: true, respondent_name: '', respondent_contact: '', respondent_sitio: '', respondent_resident_status: 'unknown' }));
      setErrors((current) => ({ ...Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith('respondent_'))), respondent_unknown: undefined }));
    } else {
      setValues((current) => ({ ...current, [name]: value }));
      setErrors((current) => ({ ...current, [name]: undefined }));
    }
    setServerError('');
  };
  const submit = async (event, asDraft = false) => {
    event.preventDefault();
    const next = { ...values, status: asDraft ? 'draft' : values.status };
    const validation = validateIntake(next);
    setErrors(validation);
    setServerError('');
    if (Object.keys(validation).length) {
      document.getElementById(Object.keys(validation)[0])?.focus();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const created = await api.post('/blotters', buildIntake(next));
      if (!created?.case_id || !created?.id) throw new ApiError({ status: 502, code: 'INVALID_RESPONSE', message: 'The service did not return the saved case details. Refresh the records before retrying.' });
      setSaved(created);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) setErrors((current) => ({ ...current, ...cause.fields }));
      setServerError(cause?.status === 409 ? `${cause.message} The record was not saved.` : cause?.message || 'The record could not be saved. Your entries remain in this form.');
      if (cause.fields && Object.keys(cause.fields).length) document.getElementById(Object.keys(cause.fields)[0])?.focus();
    } finally { setBusy(false); }
  };
  if (saved) return <div className="page-wrap narrow-wrap"><Link className="back-link" to="/blotters"><ArrowLeft size={15} /> Blotter Records</Link><section className="success-panel" aria-labelledby="saved-title"><span className="success-icon"><Check size={23} /></span><p className="greeting">Saved to the case register</p><h1 id="saved-title">{saved.case_id}</h1><p>This number was issued by the barangay record service. The record is saved as <strong>{saved.status === 'draft' ? 'Draft' : 'an official blotter'}</strong>.</p><dl className="saved-meta"><div><dt>Complainant</dt><dd>{saved.complainant_name}</dd></div><div><dt>Incident location</dt><dd>{saved.sitio}</dd></div></dl><div className="success-actions"><button className="button button-primary" onClick={() => navigate(`/blotters/${saved.id}`, { replace: true })}>View record</button><Link className="button button-secondary" to="/blotters/new" onClick={() => { setSaved(null); setValues(blankIntake()); }}>Record another</Link></div></section></div>;
  const respondentKnown = !values.respondent_unknown;
  return <div className="page-wrap form-wrap">
    <Link className="back-link" to="/blotters"><ArrowLeft size={15} /> Blotter Records</Link>
    <header className="page-heading form-heading"><div><p className="greeting">New case entry</p><h1>Record an incident</h1><p>All required details are needed, including when saving a draft.</p></div></header>
    {serverError && <div className="notice notice-error" role="alert">{serverError}<span className="notice-detail">Your entries remain in this form. Review the marked fields or retry.</span></div>}
    <form className="intake-form" onSubmit={(event) => submit(event, false)} noValidate>
      <section className="form-section"><div className="form-section-heading"><span className="section-glyph">A</span><div><h2>Incident</h2><p>When and where it happened</p></div></div>
        <div className="form-grid"><Field id="incident_type" label="Incident category" required error={errors.incident_type}><select id="incident_type" value={values.incident_type} onChange={set('incident_type')} aria-invalid={Boolean(errors.incident_type)} aria-describedby={errors.incident_type ? 'incident_type-error' : undefined}><option value="">Select a category</option>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
          <Field id="incident_datetime" label="Date and time" required hint="Philippine time (Asia/Manila)" error={errors.incident_datetime}><TextInput id="incident_datetime" type="datetime-local" value={values.incident_datetime} onChange={set('incident_datetime')} required error={errors.incident_datetime} /></Field>
          <Field id="sitio" label="Incident sitio / purok" required error={errors.sitio}><TextInput id="sitio" value={values.sitio} onChange={set('sitio')} maxLength={120} required error={errors.sitio} /></Field>
          <Field id="landmark" label="Landmark or street address" hint="Optional" error={errors.landmark}><TextInput id="landmark" value={values.landmark} onChange={set('landmark')} maxLength={255} error={errors.landmark} /></Field></div>
      </section>
      <section className="form-section"><div className="form-section-heading"><span className="section-glyph">B</span><div><h2>Complainant</h2><p>Person bringing the incident forward</p></div></div>
        <div className="form-grid"><Field id="complainant_name" label="Full name" required error={errors.complainant_name}><TextInput id="complainant_name" value={values.complainant_name} onChange={set('complainant_name')} maxLength={160} required error={errors.complainant_name} /></Field>
          <Field id="complainant_contact" label="Contact number" hint="Optional; at least seven digits if provided" error={errors.complainant_contact}><TextInput id="complainant_contact" value={values.complainant_contact} onChange={set('complainant_contact')} maxLength={20} error={errors.complainant_contact} inputMode="tel" /></Field>
          <Field id="complainant_sitio" label="Home sitio / purok" hint="Optional; do not copy the incident location" error={errors.complainant_sitio}><TextInput id="complainant_sitio" value={values.complainant_sitio} onChange={set('complainant_sitio')} maxLength={120} error={errors.complainant_sitio} /></Field>
          <Field id="complainant_resident_status" label="Residency status" required error={errors.complainant_resident_status}><select id="complainant_resident_status" value={values.complainant_resident_status} onChange={set('complainant_resident_status')} aria-invalid={Boolean(errors.complainant_resident_status)}>{RESIDENCY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field></div>
      </section>
      <section className="form-section"><div className="form-section-heading"><span className="section-glyph">C</span><div><h2>Respondent</h2><p>Enter only details that are known</p></div></div>
        <Field id="respondent_unknown" label="Do you know who the respondent is?" required error={errors.respondent_unknown}><div className="choice-row"><label className={`choice-option ${respondentKnown ? 'choice-selected' : ''}`}><input type="radio" name="respondent_unknown" value="yes" checked={respondentKnown} onChange={set('respondent_unknown')} /><span>Yes, details are known</span></label><label className={`choice-option ${!respondentKnown ? 'choice-selected' : ''}`}><input type="radio" name="respondent_unknown" value="no" checked={!respondentKnown} onChange={set('respondent_unknown')} /><span>Unknown</span></label></div></Field>
        {respondentKnown ? <div className="form-grid respondent-fields"><Field id="respondent_name" label="Full name" required error={errors.respondent_name}><TextInput id="respondent_name" value={values.respondent_name} onChange={set('respondent_name')} maxLength={160} required error={errors.respondent_name} /></Field><Field id="respondent_contact" label="Contact number" hint="Optional" error={errors.respondent_contact}><TextInput id="respondent_contact" value={values.respondent_contact} onChange={set('respondent_contact')} maxLength={20} error={errors.respondent_contact} inputMode="tel" /></Field><Field id="respondent_sitio" label="Home sitio / purok" hint="Optional; do not copy the incident location" error={errors.respondent_sitio}><TextInput id="respondent_sitio" value={values.respondent_sitio} onChange={set('respondent_sitio')} maxLength={120} error={errors.respondent_sitio} /></Field><Field id="respondent_resident_status" label="Residency status" required error={errors.respondent_resident_status}><select id="respondent_resident_status" value={values.respondent_resident_status} onChange={set('respondent_resident_status')} aria-invalid={Boolean(errors.respondent_resident_status)}>{RESIDENCY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field></div> : <p className="unknown-note">Respondent name, contact, home address, and residency will be recorded as unknown.</p>}
      </section>
      <section className="form-section"><div className="form-section-heading"><span className="section-glyph">D</span><div><h2>What happened</h2><p>Write a factual summary in plain language</p></div></div>
        <Field id="narrative" label="Incident narrative and initial actions" required error={errors.narrative}><textarea id="narrative" rows="6" maxLength={5000} value={values.narrative} onChange={set('narrative')} aria-invalid={Boolean(errors.narrative)} aria-describedby={errors.narrative ? 'narrative-error' : 'narrative-count'} required /><span id="narrative-count" className="field-hint count-hint">{values.narrative.length.toLocaleString()} / 5,000 characters</span></Field>
        <div className="form-grid status-row"><Field id="status" label="Initial status" required error={errors.status}><select id="status" value={values.status} onChange={set('status')} aria-invalid={Boolean(errors.status)}>{INITIAL_STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field><p className="form-aside">A Draft is a complete saved entry. You can submit it later without changing its assigned number.</p></div>
      </section>
      <div className="form-actions"><Link className="button button-quiet" to="/blotters"><ArrowLeft size={15} /> Cancel</Link><button className="button button-secondary" type="button" disabled={busy} onClick={(event) => submit(event, true)}>{busy ? 'Saving…' : 'Save as draft'}</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save record'} <ArrowRight size={16} /></button></div>
      <p className="form-privacy-note">The case number, barangay, creator, and creation time are assigned by the record service and cannot be edited here.</p>
    </form>
  </div>;
}
