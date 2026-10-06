import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Activity, ClipboardList, FilePlus2, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext.jsx';

const links = [
  { to: '/', label: 'Overview', icon: Activity, end: true },
  { to: '/blotters', label: 'Blotter Records', icon: ClipboardList },
  { to: '/resident-reports', label: 'Resident Reports', icon: FilePlus2 },
];
export function StaffLayout() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const navigate = useNavigate();
  const handleSignOut = async () => {
    setSignOutError('');
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      setSignOutError(error.message);
    }
  };
  return <div className="staff-shell">
    <header className="topbar">
      <Link className="wordmark" to="/" aria-label="eBarangayMo home"><span className="wordmark-mark">eB</span><span>eBarangay<span className="wordmark-soft">Mo</span></span></Link>
      <div className="topbar-context"><span>{user?.barangay?.name || 'Barangay'}</span><span className="context-divider" aria-hidden="true" /> <span>{user?.city?.name || 'City'}</span></div>
      <button className="mobile-menu icon-button" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} onClick={() => setOpen((current) => !current)}>{open ? <X size={19} /> : <Menu size={19} />}</button>
      <div className="account"><span className="avatar" aria-hidden="true">{(user?.display_name || user?.username || 'S').slice(0, 1).toUpperCase()}</span><div className="account-copy"><strong>{user?.display_name || user?.username}</strong><span>Desk officer</span></div><button className="signout-button" onClick={handleSignOut}><LogOut size={15} /> <span>Sign out</span></button></div>
    </header>
    {signOutError && <div className="top-alert" role="alert">{signOutError}</div>}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="Staff navigation">
      <p className="nav-heading">Workspace</p>
      <nav className="primary-nav">{links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Resident Reports' ? <span className="nav-live" aria-label="Pending review queue" /> : null}</NavLink>)}</nav>
      <div className="sidebar-footer"><div className="tenant-mark" aria-hidden="true">{user?.barangay?.code?.slice(0, 2) || 'BR'}</div><div><strong>{user?.barangay?.name || 'Barangay workspace'}</strong><span>Private staff workspace</span></div></div>
    </aside>
    <main id="main-content" className="main-content"><Outlet /></main>
  </div>;
}
