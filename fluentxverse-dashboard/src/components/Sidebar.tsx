import { useLocation } from 'preact-iso';
import { useState, useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { adminApi } from '../api/admin.api';
import { operations } from '../api/operations.api';
import './Sidebar.css';
import { AdminArt, type AdminArtName } from './AdminArt';

interface NavItem {
  path: string;
  icon: string;
  label: string;
  badgeKey?: string;
  superadminOnly?: boolean;
}

const navItems: NavItem[] = [
  { path: '/', icon: 'ri-dashboard-3-line', label: 'Dashboard' },
  { path: '/interviews', icon: 'ri-calendar-schedule-line', label: 'Interviews' },
  { path: '/applications', icon: 'ri-file-user-line', label: 'Applications', badgeKey: 'pendingApplications' },
  { path: '/tutors', icon: 'ri-user-star-line', label: 'Tutors' },
  { path: '/students', icon: 'ri-graduation-cap-line', label: 'Students' },
  { path: '/inbox', icon: 'ri-mail-send-line', label: 'Inbox Messages' },
  { path: '/tasks', icon: 'ri-list-check-3', label: 'Tasks & Suggestions' },
  { path: '/testing', icon: 'ri-checkbox-circle-line', label: 'Testing' },
  { path: '/email', icon: 'ri-mail-line', label: 'Email' },
  ...(import.meta.env.VITE_ENABLE_TICKETING === 'true' ? [{ path: '/tickets', icon: 'ri-ticket-2-line', label: 'Ticket NFTs' }] : []),
  { path: '/lesson-material-maker', icon: 'ri-draft-line', label: 'Lesson Maker' },
  { path: '/sessions', icon: 'ri-video-chat-line', label: 'Sessions' },
  { path: '/recordings', icon: 'ri-record-circle-line', label: 'QA Recordings' },
  { path: '/lesson-operations', icon: 'ri-history-line', label: 'Lesson Operations' },
  { path: '/analytics', icon: 'ri-bar-chart-box-line', label: 'Analytics' },
  { path: '/server-health', icon: 'ri-server-line', label: 'Server Health' },
  { path: '/stats', icon: 'ri-bar-chart-horizontal-line', label: 'Stats' },
  { path: '/alerts', icon: 'ri-alarm-warning-line', label: 'Alerts' },
  { path: '/ceo-orientation', icon: 'ri-user-voice-line', label: 'CEO Orientation' },
  { path: '/platform-overview', icon: 'ri-book-open-line', label: 'Platform Guide' },
  { path: '/payments', icon: 'ri-money-dollar-circle-line', label: 'Payments' },
  { path: '/admins', icon: 'ri-admin-line', label: 'Admins', superadminOnly: true },
  { path: '/settings', icon: 'ri-settings-3-line', label: 'Settings' },
];

const navigationArt: Record<string, AdminArtName> = {
  '/':'home', '/interviews':'schedule', '/applications':'training', '/tutors':'community',
  '/students':'training', '/tickets':'pay', '/lesson-material-maker':'training',
  '/sessions':'schedule', '/analytics':'growth', '/payments':'pay',
  '/platform-overview':'training',
};

export function Sidebar({ open = false, onClose }: { open?: boolean; onClose?: () => void }) {
  const { path } = useLocation();
  const { user, logout } = useAuthContext();
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [permissions, setPermissions] = useState<string[]>([]);
  const navigationRef = useRef<HTMLElement>(null);
  useEffect(() => { if (open) onClose?.(); }, [path]);
  useLayoutEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(navigationRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []);
    focusable()[0]?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key !== 'Tab') return;
      const controls = focusable(), first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const compact = window.matchMedia('(max-width:1024px)');
    const closeOnDesktop = () => { if (!compact.matches) onClose?.(); };
    compact.addEventListener('change', closeOnDesktop);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      compact.removeEventListener('change', closeOnDesktop);
    };
  }, [open, onClose]);
  useEffect(() => { operations('/access').then(a => setPermissions(Array.isArray(a?.permissions) ? a.permissions : [])).catch(() => setPermissions([])); }, []);

  const isSuperAdmin = user?.role === 'superadmin';

  // Fetch badge counts
  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const pendingTutors = await adminApi.getPendingTutors();
        setBadges({
          pendingApplications: pendingTutors.length,
        });
      } catch (error) {
        console.error('Failed to fetch badge counts:', error);
      }
    };

    fetchBadges();
    // Refresh every 60 seconds
    const interval = setInterval(fetchBadges, 60000);
    return () => clearInterval(interval);
  }, []);

  // Filter nav items based on role
  const mainNavItems = navItems.slice(0, 8);
  const managementNavItems = navItems.slice(8).filter(
    (item) => (!item.superadminOnly || isSuperAdmin) &&
      (!['/payments', '/tickets'].includes(item.path) || permissions.includes('finance')) &&
      (item.path !== '/recordings' || permissions.includes('qa')) &&
      (!['/server-health', '/stats', '/alerts'].includes(item.path) || permissions.includes('operations'))
  );

  const getInitials = () => {
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'AD';
  };

  const getDisplayName = () => {
    return user?.username || 'Admin';
  };

  const getRoleLabel = () => {
    return user?.role === 'superadmin' ? 'Super Admin' : 'Admin';
  };

  return (
    <>
    {open && <button type="button" className="admin-navigation-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside ref={navigationRef} className={`sidebar ${open ? 'open' : ''}`} id="admin-navigation">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img
            src="/assets/img/logo/icon_logo.png"
            alt="FluentXVerse Logo"
            className="logo-icon-img"
          />
          <div className="logo-text">
            <span className="logo-title">FluentXVerse</span>
            <span className="logo-subtitle">Administration</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Administration">
        <div className="nav-section">
          <span className="nav-section-title">Main Menu</span>
          <ul className="nav-list">
            {mainNavItems.map((item) => {
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;
              return (
                <li key={item.path}>
                  <a
                    href={item.path}
                    className={`nav-item ${path === item.path ? 'active' : ''}`}
                    aria-current={path === item.path ? 'page' : undefined}
                  >
                    {navigationArt[item.path] ? <AdminArt name={navigationArt[item.path]} /> : <i className={item.icon} aria-hidden="true"></i>}
                    <span>{item.label}</span>
                    {badgeCount !== undefined && badgeCount > 0 && (
                      <span className="nav-badge">{badgeCount}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="nav-section">
          <span className="nav-section-title">Management</span>
          <ul className="nav-list">
            {managementNavItems.map((item) => {
              const badgeCount = item.badgeKey ? badges[item.badgeKey] : undefined;
              return (
                <li key={item.path}>
                  <a
                    href={item.path}
                    className={`nav-item ${path === item.path ? 'active' : ''}`}
                    aria-current={path === item.path ? 'page' : undefined}
                  >
                    {navigationArt[item.path] ? <AdminArt name={navigationArt[item.path]} /> : <i className={item.icon} aria-hidden="true"></i>}
                    <span>{item.label}</span>
                    {badgeCount !== undefined && badgeCount > 0 && (
                      <span className="nav-badge">{badgeCount}</span>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="admin-profile">
          <div className="avatar">
            <span>{getInitials()}</span>
          </div>
          <div className="admin-info">
            <span className="admin-name">{getDisplayName()}</span>
            <span className="admin-role">{getRoleLabel()}</span>
          </div>
          <a href="/settings" className="change-pw-btn" title="Change Password">
            <i className="ri-lock-password-line"></i>
          </a>
          <button className="logout-btn" title="Logout" onClick={logout}>
            <i className="ri-logout-box-r-line"></i>
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
