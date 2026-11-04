import { useCallback, useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { ApiError, api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

function DetailLine({ label, children }) { return <div className="detail-line"><dt>{label}</dt><dd>{children || '—'}</dd></div>; }

function blankForm(profile) {
  return { name: profile?.name || '', hall_address: profile?.hall_address || '', contact_number: profile?.contact_number || '' };
}

export function BarangayPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(blankForm(null));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await api.get('/barangay');
      setProfile(data);
      setForm(blankForm(data));
    } catch (cause) {
      setLoadError(cause.message);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = (name) => (event) => {
    setForm((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setSaveError('');
    setNotice('');
  };

  const save = async (event) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = 'Enter the barangay name';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      document.getElementById('barangay-name')?.focus();
      return;
    }
    setBusy(true);
    try {
      const updated = await api.patch('/barangay', form);
      setProfile(updated);
      setForm(blankForm(updated));
      setNotice('Barangay profile saved.');
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) setErrors(cause.fields);
      setSaveError(cause.message);
    } finally { setBusy(false); }
  };

  return <div className="page-wrap">
    <header className="page-heading"><div><p className="greeting">{profile?.city?.name || 'Barangay profile'}</p><h1>{profile?.name || 'Barangay profile'}</h1><p>Office details shown on the public reporting form.</p></div></header>
    {loading && <div className="table-loading" role="status">Loading barangay profile…</div>}
    {loadError && <div className="notice notice-error" role="alert"><span>{loadError}</span><button className="button button-quiet" onClick={load}><RotateCw size={15} /> Try again</button></div>}
    {!loading && !loadError && profile && <>
      {notice && <div className="notice notice-success" role="status">{notice}</div>}
      <div className="detail-layout"><div className="detail-main">
        <section className="detail-section" aria-labelledby="profile-heading"><div className="detail-section-title"><h2 id="profile-heading">Barangay details</h2><span>Read-only identifiers</span></div>
          <dl className="detail-grid">
            <DetailLine label="Barangay name">{profile.name}</DetailLine>
            <DetailLine label="City">{profile.city?.name}</DetailLine>
            <DetailLine label="Case number code">{profile.code}</DetailLine>
            <DetailLine label="Public link name">{profile.slug}</DetailLine>
            <DetailLine label="Hall address">{profile.hall_address}</DetailLine>
            <DetailLine label="Contact number">{profile.contact_number}</DetailLine>
          </dl>
        </section>
        {isAdmin ? <form className="intake-form" onSubmit={save} noValidate>
          <div className="form-section"><div className="form-section-heading"><div><h2>Edit office details</h2><p>Case number codes and public link names cannot be changed here.</p></div></div>
            <div className="form-grid">
              <div className={`field ${errors.name ? 'field-invalid' : ''}`}><label htmlFor="barangay-name">Barangay name<span className="required-marker"> required</span></label><input id="barangay-name" name="name" maxLength={120} value={form.name} onChange={update('name')} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'barangay-name-error' : undefined} />{errors.name && <span className="field-error" id="barangay-name-error" role="alert">{errors.name}</span>}</div>
              <div className={`field ${errors.contact_number ? 'field-invalid' : ''}`}><label htmlFor="contact-number">Contact number</label><span className="field-hint" id="contact-number-hint">Optional; 7–20 digits, spaces, +, -, ( or )</span><input id="contact-number" name="contact_number" type="tel" inputMode="tel" maxLength={20} value={form.contact_number} onChange={update('contact_number')} aria-invalid={Boolean(errors.contact_number)} aria-describedby="contact-number-hint" />{errors.contact_number && <span className="field-error" role="alert">{errors.contact_number}</span>}</div>
              <div className={`field ${errors.hall_address ? 'field-invalid' : ''}`}><label htmlFor="hall-address">Hall address</label><span className="field-hint" id="hall-address-hint">Optional; shown to residents on the reporting form</span><input id="hall-address" name="hall_address" maxLength={255} value={form.hall_address} onChange={update('hall_address')} aria-invalid={Boolean(errors.hall_address)} aria-describedby="hall-address-hint" />{errors.hall_address && <span className="field-error" role="alert">{errors.hall_address}</span>}</div>
            </div>
          </div>
          {saveError && <div className="notice notice-error" role="alert">{saveError}</div>}
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save barangay details'}</button></div>
        </form> : <p className="small-note">Only barangay administrators can change these details.</p>}
      </div>
      <aside className="detail-aside" aria-label="Public reporting link">
        <section className="detail-section"><div className="detail-section-title"><h2>Public reporting form</h2></div>
          <p className="small-note">Residents use this link or QR code to send reports for staff review.</p>
          <a href={profile.report_url} className="text-link">{profile.report_url}</a>
          <div className="qr-code"><QRCodeCanvas value={profile.report_url} size={116} includeMargin /></div>
        </section>
      </aside></div>
    </>}
  </div>;
}
