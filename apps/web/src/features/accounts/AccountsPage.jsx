import { useCallback, useEffect, useState } from 'react';
import { KeyRound, RotateCw, UserPlus } from 'lucide-react';
import { ApiError, api } from '../../api/client.js';
import { useAuth } from '../../auth/AuthContext.jsx';

const ROLE_LABELS = { admin: 'Administrator', staff: 'Desk staff' };
const USERNAME_PATTERN = /^[a-z0-9_.]{3,80}$/;
const blankAccount = { username: '', display_name: '', role: 'staff', password: '' };

function Field({ id, label, required, hint, error, children }) {
  return <div className={`field ${error ? 'field-invalid' : ''}`}><label htmlFor={id}>{label}{required && <span className="required-marker"> required</span>}</label>{hint && <span className="field-hint" id={`${id}-hint`}>{hint}</span>}{children}{error && <span className="field-error" id={`${id}-error`} role="alert">{error}</span>}</div>;
}

function validateNewAccount(values) {
  const errors = {};
  const username = values.username.trim().toLowerCase();
  if (!username) errors.username = 'Enter a username';
  else if (!USERNAME_PATTERN.test(username)) errors.username = 'Use 3–80 letters, numbers, dots, or underscores';
  if (!values.display_name.trim()) errors.display_name = 'Enter a display name';
  if (values.password.length < 10 || values.password.length > 128) errors.password = 'Use 10–128 characters';
  return errors;
}

export function AccountsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(isAdmin);
  const [loadError, setLoadError] = useState('');
  const [values, setValues] = useState(blankAccount);
  const [errors, setErrors] = useState({});
  const [createError, setCreateError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [resetId, setResetId] = useState(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try { setAccounts(await api.get('/accounts')); }
    catch (cause) { setLoadError(cause.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (!isAdmin) {
    return <div className="page-wrap">
      <header className="page-heading"><div><p className="greeting">Barangay workspace</p><h1>Accounts</h1></div></header>
      <div className="notice notice-neutral" role="status">Account management is available to barangay administrators.</div>
    </div>;
  }

  const update = (name) => (event) => {
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setCreateError('');
  };

  const createAccount = async (event) => {
    event.preventDefault();
    if (busy) return;
    const validation = validateNewAccount(values);
    setErrors(validation);
    setCreateError('');
    setNotice('');
    if (Object.keys(validation).length) {
      document.getElementById(Object.keys(validation)[0])?.focus();
      return;
    }
    setBusy(true);
    try {
      const created = await api.post('/accounts', { username: values.username, display_name: values.display_name, role: values.role, password: values.password });
      setValues(blankAccount);
      setNotice(`Created ${created.username}.`);
      await load();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 422) setErrors((current) => ({ ...current, ...cause.fields }));
      setCreateError(cause.message);
    } finally { setBusy(false); }
  };

  const changeAccount = async (account, changes, success) => {
    setNotice('');
    setActionError('');
    try {
      const updated = await api.patch(`/accounts/${account.id}`, changes);
      setAccounts((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setNotice(success(updated));
    } catch (cause) {
      setActionError(cause.message);
    }
  };

  const submitReset = async (event, account) => {
    event.preventDefault();
    setResetError('');
    if (resetPassword.length < 10 || resetPassword.length > 128) {
      setResetError('Use 10–128 characters');
      document.getElementById(`reset-password-${account.id}`)?.focus();
      return;
    }
    try {
      await api.post(`/accounts/${account.id}/password`, { password: resetPassword });
      setResetId(null);
      setResetPassword('');
      setNotice(`Password reset for ${account.username}. Their existing sign-ins were ended.`);
    } catch (cause) {
      setResetError(cause.message);
    }
  };

  return <div className="page-wrap">
    <header className="page-heading"><div><p className="greeting">Barangay workspace</p><h1>Accounts</h1><p>Create desk accounts, change roles, and reset passwords for this barangay.</p></div></header>
    {notice && <div className="notice notice-success" role="status">{notice}</div>}
    {actionError && <div className="notice notice-error" role="alert">{actionError}</div>}
    <form className="intake-form" onSubmit={createAccount} noValidate>
      <div className="form-section"><div className="form-section-heading"><UserPlus size={18} /><div><h2>Add an account</h2><p>Share the temporary password privately. Users should change it after signing in.</p></div></div>
        <div className="form-grid">
          <Field id="username" label="Username" required hint="3–80 letters, numbers, dots, or underscores" error={errors.username}><input id="username" name="username" autoComplete="off" maxLength={80} value={values.username} onChange={update('username')} aria-invalid={Boolean(errors.username)} aria-describedby={errors.username ? 'username-error' : 'username-hint'} /></Field>
          <Field id="display_name" label="Display name" required error={errors.display_name}><input id="display_name" name="display_name" maxLength={160} value={values.display_name} onChange={update('display_name')} aria-invalid={Boolean(errors.display_name)} /></Field>
          <Field id="role" label="Role" required><select id="role" name="role" value={values.role} onChange={update('role')}><option value="staff">Desk staff</option><option value="admin">Administrator</option></select></Field>
          <Field id="password" label="Temporary password" required hint="10–128 characters" error={errors.password}><input id="password" name="password" type="password" autoComplete="new-password" maxLength={128} value={values.password} onChange={update('password')} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : 'password-hint'} /></Field>
        </div>
      </div>
      {createError && <div className="notice notice-error" role="alert">{createError}</div>}
      <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button></div>
    </form>

    <section className="record-section" aria-label="Barangay accounts">
      <div className="record-section-top"><div><h2>Accounts</h2><p>{loading ? 'Loading accounts…' : loadError ? 'Accounts unavailable' : `${accounts.length} accounts`}</p></div>{loadError && <button className="button button-quiet" onClick={load}><RotateCw size={15} /> Retry</button>}</div>
      {loadError && <div className="notice notice-error" role="alert">{loadError}</div>}
      {loading ? <div className="table-loading" role="status">Loading accounts…</div> : !loadError && <div className="table-scroll"><table className="records-table">
        <thead><tr><th scope="col">Username</th><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr></thead>
        <tbody>{accounts.map((account) => {
          const self = account.id === user.id;
          return <tr key={account.id}>
            <td>{account.username}{self && <span className="field-hint"> (you)</span>}</td>
            <td>{account.display_name}</td>
            <td>{ROLE_LABELS[account.role] || account.role}</td>
            <td><span className={`status-badge ${account.is_active ? 'status-settled_at_desk' : 'status-draft'}`}><i aria-hidden="true" />{account.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
              <div className="row-actions">
                <button className="button button-quiet" disabled={self && account.role === 'admin'} onClick={() => changeAccount(account, { role: account.role === 'admin' ? 'staff' : 'admin' }, (updated) => `${updated.username} is now ${ROLE_LABELS[updated.role].toLowerCase()}.`)}>{account.role === 'admin' ? 'Make desk staff' : 'Make administrator'}</button>
                <button className="button button-quiet" disabled={self && account.is_active} onClick={() => changeAccount(account, { is_active: !account.is_active }, (updated) => `${updated.username} is now ${updated.is_active ? 'active' : 'inactive'}.`)}>{account.is_active ? 'Deactivate' : 'Activate'}</button>
                <button className="button button-quiet" aria-expanded={resetId === account.id} onClick={() => { setResetId(resetId === account.id ? null : account.id); setResetPassword(''); setResetError(''); }}><KeyRound size={14} /> Reset password</button>
              </div>
              {resetId === account.id && <form className="row-reset-form" onSubmit={(event) => submitReset(event, account)} noValidate>
                <Field id={`reset-password-${account.id}`} label={`New password for ${account.username}`} hint="10–128 characters" error={resetError}><input id={`reset-password-${account.id}`} type="password" autoComplete="new-password" maxLength={128} value={resetPassword} onChange={(event) => { setResetPassword(event.target.value); setResetError(''); }} aria-invalid={Boolean(resetError)} /></Field>
                <div className="row-actions"><button className="button button-primary" type="submit">Set new password</button><button className="button button-quiet" type="button" onClick={() => setResetId(null)}>Cancel</button></div>
              </form>}
            </td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </div>;
}
