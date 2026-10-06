import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, RotateCw, Search } from 'lucide-react';
import { api, queryString } from '../../api/client.js';
import { formatManilaDateTime } from '../../utils/intake.js';
import { categoryLabel, statusLabel } from '../../utils/display.js';

export function ResidentReportsPage() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') || 'pending_review');
  const [q, setQ] = useState(params.get('q') || '');
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setResult(await api.getList(`/resident-reports${queryString({ status, q, page, page_size: 20 })}`)); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [status, q, page]);
  useEffect(() => { load(); }, [load]);
  const data = Array.isArray(result?.items) ? result.items : [];
  const meta = result?.meta || { page, page_size: 20, total: 0, total_pages: 1 };
  const applySearch = (event) => { event.preventDefault(); const nextPage = 1; setPage(nextPage); setParams(queryString({ status, q, page: nextPage }).slice(1)); };
  const pageTo = (nextPage) => { setPage(nextPage); setParams(queryString({ status, q, page: nextPage }).slice(1)); };
  const selectStatus = (nextStatus) => { const nextPage = 1; setPage(nextPage); setStatus(nextStatus); setParams(queryString({ status: nextStatus, q, page: nextPage }).slice(1)); };
  return <div className="page-wrap">
    <header className="page-heading"><div><p className="greeting">Resident-submitted incidents</p><h1>Resident Reports</h1><p>Original submissions stay unchanged. Review before making an official record.</p></div><span className="queue-note"><span className="queue-dot" /> Private staff queue</span></header>
    <section className="queue-tabs" aria-label="Filter resident reports by status"><button className={status === 'pending_review' ? 'queue-tab queue-tab-active' : 'queue-tab'} aria-pressed={status === 'pending_review'} onClick={() => selectStatus('pending_review')}>Pending review</button><button className={status === 'approved' ? 'queue-tab queue-tab-active' : 'queue-tab'} aria-pressed={status === 'approved'} onClick={() => selectStatus('approved')}>Approved</button><button className={status === 'rejected' ? 'queue-tab queue-tab-active' : 'queue-tab'} aria-pressed={status === 'rejected'} onClick={() => selectStatus('rejected')}>Rejected</button></section>
    <form className="queue-search" onSubmit={applySearch}><Search size={16} /><input aria-label="Search reference or reporter name" value={q} maxLength={160} onChange={(event) => setQ(event.target.value)} placeholder="Reference or reporter name" /><button className="button button-secondary" type="submit">Search</button></form>
    <section className="record-section" aria-label="Resident reports"><div className="record-section-top"><div><h2>{statusLabel(status)}</h2><p>{loading ? 'Loading reports…' : error ? 'Reports unavailable' : `${Number(meta.total).toLocaleString()} reports`}</p></div>{error && <button className="button button-quiet" onClick={load}><RotateCw size={15} /> Retry</button>}</div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {loading ? <div className="table-loading" role="status">Loading resident reports…</div> : !error && data.length === 0 ? <div className="empty-state"><div className="empty-glyph"><FileText size={21} /></div><h3>{status === 'pending_review' ? 'No reports waiting for review' : `No ${statusLabel(status).toLowerCase()} reports`}</h3><p>{status === 'pending_review' ? 'New public submissions will appear here for staff review.' : 'Change the status filter to view other reports.'}</p></div> : !error && <><div className="table-scroll"><table className="records-table"><thead><tr><th scope="col">Reference</th><th scope="col">Reporter</th><th scope="col">Incident</th><th scope="col">Submitted</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Open report</span></th></tr></thead><tbody>{data.map((report) => <tr key={report.id}><td><Link className="case-id" to={`/resident-reports/${report.id}`}>{report.reference}</Link></td><td className="person-cell">{report.original?.reporter_name || report.reporter_name || '—'}</td><td>{categoryLabel(report.original?.incident_type || report.incident_type)}</td><td>{formatManilaDateTime(report.submitted_at)}</td><td><span className={`status-badge status-${report.status}`}><i aria-hidden="true" />{statusLabel(report.status)}</span></td><td><Link className="row-open" to={`/resident-reports/${report.id}`}>Review <ChevronRight size={15} /></Link></td></tr>)}</tbody></table></div><div className="pagination"><span>Page {meta.page} of {Math.max(1, meta.total_pages)} <span className="pagination-count">({Number(meta.total).toLocaleString()} total)</span></span><div><button className="icon-button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => pageTo(page - 1)}><ChevronLeft size={17} /></button><button className="icon-button" aria-label="Next page" disabled={page >= meta.total_pages || loading} onClick={() => pageTo(page + 1)}><ChevronRight size={17} /></button></div></div></>}
    </section>
  </div>;
}
