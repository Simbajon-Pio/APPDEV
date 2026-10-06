import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FilePlus2, Filter, RotateCw, Search } from 'lucide-react';
import { api, queryString } from '../../api/client.js';
import { CATEGORY_OPTIONS, STATUS_OPTIONS } from '../../utils/intake.js';
import { categoryLabel, statusLabel } from '../../utils/display.js';
import { formatManilaDateTime } from '../../utils/intake.js';

const initialFilters = { q: '', status: '', incident_type: '', sitio: '', date_from: '', date_to: '' };
export function BlottersPage() {
  const [params, setParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({ ...initialFilters, ...Object.fromEntries(['q', 'status', 'incident_type', 'sitio', 'date_from', 'date_to'].map((key) => [key, params.get(key) || ''])) }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({ ...initialFilters, ...Object.fromEntries(['q', 'status', 'incident_type', 'sitio', 'date_from', 'date_to'].map((key) => [key, params.get(key) || ''])) }));
  const [result, setResult] = useState(null);
  const [page, setPage] = useState(Number(params.get('page')) || 1);
  const [appliedPage, setAppliedPage] = useState(Number(params.get('page')) || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const paramsKey = params.toString();
  const load = useCallback(async (currentFilters, currentPage) => {
    setLoading(true); setError('');
    try {
      const data = await api.getList(`/blotters${queryString({ ...currentFilters, page: currentPage, page_size: 20 })}`);
      setResult(data);
    } catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(appliedFilters, appliedPage); }, [appliedFilters, appliedPage, load]);
  const apply = (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
    setPage(1);
    setAppliedPage(1);
    setParams(queryString({ ...filters, page: 1 }).slice(1));
  };
  const pageTo = (nextPage) => {
    setPage(nextPage);
    setAppliedPage(nextPage);
    setParams(queryString({ ...appliedFilters, page: nextPage }).slice(1));
  };
  useEffect(() => {
    const routeParams = new URLSearchParams(paramsKey);
    const fromParams = { ...initialFilters, ...Object.fromEntries(['q', 'status', 'incident_type', 'sitio', 'date_from', 'date_to'].map((key) => [key, routeParams.get(key) || ''])) };
    const nextPage = Number(routeParams.get('page')) || 1;
    setFilters((current) => JSON.stringify(current) === JSON.stringify(fromParams) ? current : fromParams);
    setAppliedFilters((current) => JSON.stringify(current) === JSON.stringify(fromParams) ? current : fromParams);
    setPage((current) => current === nextPage ? current : nextPage);
    setAppliedPage((current) => current === nextPage ? current : nextPage);
  }, [paramsKey]);
  const clear = () => { setFilters(initialFilters); setAppliedFilters(initialFilters); setPage(1); setAppliedPage(1); setParams({}); };
  const meta = result?.meta || { page, page_size: 20, total: 0, total_pages: 0 };
  const cases = Array.isArray(result?.items) ? result.items : [];
  return <div className="page-wrap">
    <header className="page-heading"><div><p className="greeting">Official record register</p><h1>Blotter Records</h1><p>Find a record by case number, party, incident type, or date.</p></div><Link className="button button-primary" to="/blotters/new"><FilePlus2 size={17} /> Record an incident</Link></header>
    <form className="filter-panel" onSubmit={apply}>
      <div className="search-field"><Search size={17} /><input aria-label="Search case number or party name" placeholder="Case number or party name" maxLength={160} value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} /></div>
      <div className="filters-grid">
        <label className="compact-field"><span>Status</span><select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">Active records</option>{STATUS_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="compact-field"><span>Category</span><select aria-label="Filter by category" value={filters.incident_type} onChange={(event) => setFilters((current) => ({ ...current, incident_type: event.target.value }))}><option value="">All categories</option>{CATEGORY_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="compact-field"><span>Sitio / purok</span><input aria-label="Filter by sitio" value={filters.sitio} maxLength={120} onChange={(event) => setFilters((current) => ({ ...current, sitio: event.target.value }))} /></label>
        <label className="compact-field"><span>Incident from</span><input aria-label="Incident date from" type="date" value={filters.date_from} onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))} /></label>
        <label className="compact-field"><span>Incident to</span><input aria-label="Incident date to" type="date" value={filters.date_to} onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))} /></label>
      </div>
      <div className="filter-actions"><span><Filter size={14} /> Filters combine with search</span><button className="button button-quiet" type="button" onClick={clear}>Clear</button><button className="button button-secondary" type="submit">Apply filters</button></div>
    </form>
    <section className="record-section" aria-label="Blotter records">
      <div className="record-section-top"><div><h2>{filters.status === 'draft' ? 'Saved drafts' : 'Active records'}</h2><p>{loading ? 'Loading records…' : error ? 'Records unavailable' : `${Number(meta.total).toLocaleString()} records`}</p></div>{error && <button className="button button-quiet" onClick={() => load(filters, page)}><RotateCw size={15} /> Retry</button>}</div>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {loading ? <div className="table-loading" role="status">Loading records…</div> : !error && cases.length === 0 ? <div className="empty-state"><div className="empty-glyph"><Search size={21} /></div><h3>{filters.status === 'draft' ? 'No drafts saved' : 'No records match these filters'}</h3><p>{filters.status === 'draft' ? 'A valid entry saved as Draft will appear here.' : 'Try a different search or clear one of the filters.'}</p>{filters.status !== 'draft' && <button className="button button-quiet" onClick={clear}>Clear filters</button>}</div> : !error && <>
        <div className="table-scroll"><table className="records-table"><thead><tr><th scope="col">Case number</th><th scope="col">Incident</th><th scope="col">Complainant</th><th scope="col">Location</th><th scope="col">Incident date</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Open record</span></th></tr></thead><tbody>{cases.map((record) => <tr key={record.id}><td><Link className="case-id" to={`/blotters/${record.id}`}>{record.case_id}</Link><span className="case-source">{record.source === 'resident_report' ? 'Resident report' : 'Walk-in'}</span></td><td>{categoryLabel(record.incident_type)}</td><td className="person-cell">{record.complainant_name}</td><td>{record.sitio}</td><td>{formatManilaDateTime(record.incident_datetime)}</td><td><span className={`status-badge status-${record.status}`}><i aria-hidden="true" />{statusLabel(record.status)}</span></td><td><Link className="row-open" to={`/blotters/${record.id}`} aria-label={`Open ${record.case_id}`}>Open <ChevronRight size={15} /></Link></td></tr>)}</tbody></table></div>
        <div className="pagination"><span>Page {meta.page} of {Math.max(1, meta.total_pages)} <span className="pagination-count">({Number(meta.total).toLocaleString()} total)</span></span><div><button className="icon-button" aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => pageTo(page - 1)}><ChevronLeft size={17} /></button><button className="icon-button" aria-label="Next page" disabled={page >= meta.total_pages || loading} onClick={() => pageTo(page + 1)}><ChevronRight size={17} /></button></div></div>
      </>}</section>
  </div>;
}
