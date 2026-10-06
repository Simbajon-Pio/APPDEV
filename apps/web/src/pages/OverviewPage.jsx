import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FilePlus2, RotateCw } from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const metrics = [
  ['total_blotters', 'Official blotters'],
  ['pending_lupon', 'Pending Lupon'],
  ['settled_at_desk', 'Settled at Desk'],
  ['referred_to_pnp', 'Referred to PNP'],
  ['unresolved', 'Unresolved'],
  ['pending_reports', 'Reports to review'],
];
export function OverviewPage() {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setCounts(await api.get('/overview')); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  return <div className="page-wrap">
    <header className="page-heading overview-heading"><div><p className="greeting">{user?.barangay?.name || 'Barangay workspace'}</p><h1>Overview</h1><p>Today’s desk, at a glance.</p></div><Link className="button button-primary" to="/blotters/new"><FilePlus2 size={17} /> Record an incident</Link></header>
    {error && <div className="notice notice-error" role="alert"><span>{error}</span><button className="button button-quiet" onClick={load}><RotateCw size={15} /> Try again</button></div>}
    <section className="overview-section" aria-labelledby="counts-heading">
      <div className="section-heading"><div><h2 id="counts-heading">Case register</h2><p>Live totals for this barangay. Drafts are excluded.</p></div>{!loading && !error && <span className="live-indicator"><span /> Current</span>}</div>
      {loading ? <div className="metric-skeleton" role="status">Loading case totals…</div> : !error && <div className="metric-grid">{metrics.map(([key, label]) => <article className={`metric-item ${key === 'pending_reports' ? 'metric-subtle' : ''}`} key={key}><span>{label}</span><strong>{Number(counts?.[key] || 0).toLocaleString()}</strong>{key === 'pending_reports' && <Link to="/resident-reports" aria-label="Review pending reports">Open queue <ArrowUpRight size={13} /></Link>}</article>)}</div>}
    </section>
    <section className="overview-lower">
      <article className="welcome-note"><span className="welcome-mark"><FilePlus2 size={20} /></span><div><h2>Start with the record</h2><p>Log a walk-in incident with its full details. A saved draft still needs all required information and receives its permanent case number.</p><Link to="/blotters/new" className="text-link">Create a blotter <ArrowUpRight size={15} /></Link></div></article>
      <article className="public-link-panel"><div><h2>Resident reporting</h2><p>Share the public form for this barangay. Reports are stored for staff review.</p></div><Link className="button button-secondary" to="/resident-reports">Review reports</Link></article>
    </section>
  </div>;
}
