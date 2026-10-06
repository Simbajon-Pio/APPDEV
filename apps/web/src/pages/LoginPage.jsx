import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';
import { ApiError } from '../api/client.js';

export function LoginPage() {
  const { user, signIn, authError } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  if (user) return <Navigate to="/" replace />;
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(form);
      navigate(location.state?.from || '/', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'Sign-in could not be completed.');
    } finally {
      setBusy(false);
    }
  };
  return <main className="login-page">
    <header className="login-brand"><Link className="wordmark" to="/report"><span className="wordmark-mark">eB</span><span>eBarangay<span className="wordmark-soft">Mo</span></span></Link><span className="staff-access"><ShieldCheck size={16} /> Authorized staff</span></header>
    <section className="login-panel" aria-labelledby="login-title">
      <div className="login-symbol"><ShieldCheck size={24} strokeWidth={1.7} /></div>
      <h1 id="login-title">Welcome back</h1>
      <p className="login-intro">Sign in to your barangay workspace.</p>
      {(error || authError) && <div className="notice notice-error" role="alert">{error || authError}</div>}
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="username">Username</label><input id="username" name="username" autoComplete="username" required maxLength={80} value={form.username} onChange={change} /></div>
        <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} value={form.password} onChange={change} /></div>
        <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="login-footnote">Staff access is provisioned by your barangay. Resident submissions are available from the public reporting link.</p>
    </section>
    <footer className="login-footer">eBarangayMo <span>•</span> Private records for authorized staff</footer>
  </main>;
}
