import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { adminApi, RecentActivity } from '../api/admin.api';
import { createRealtimeSocket, type RealtimeSocket } from '../client/realtimeSocket';
import './Header.css';
import { useLocation } from 'preact-iso';
import { ActivityTimestamp } from './ActivityTimestamp';
import { useActivityClock } from '../hooks/useActivityClock';

const pageNames: Record<string, string> = {
  '/':'Overview', '/tutors':'Tutors', '/students':'Students', '/applications':'Applications',
  '/interviews':'Interviews', '/sessions':'Sessions', '/recordings':'QA Recordings',
  '/lesson-operations':'Lesson Operations', '/tickets':'Tickets', '/payments':'Payments',
  '/analytics':'Analytics', '/tasks':'Tasks & Suggestions', '/inbox':'Inbox',
  '/testing':'Testing',
  '/admins':'Administrators', '/settings':'Settings', '/lesson-material-maker':'Lesson Maker',
  '/ceo-orientation':'CEO Orientation', '/platform-overview':'Platform Guide',
};
export function Header({ navigationOpen = false, onToggleNavigation }: { navigationOpen?: boolean; onToggleNavigation?: () => void }) {
  const { path } = useLocation();
  const now = useActivityClock();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuthContext();
  const socketRef = useRef<RealtimeSocket | null>(null);
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadNotifications();
    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // Close notifications if clicking outside
      if (showNotifications && notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
      
      // Close user menu if clicking outside
      if (showUserMenu && userMenuRef.current && !userMenuRef.current.contains(target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications, showUserMenu]);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await adminApi.getRecentActivity(10);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time activity feed updates via native WebSocket notifications
  useEffect(() => {
    if (!user?.userId) return;

    const socket = createRealtimeSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      // Subscribe to notifications and join admin room
      socket.emit('notification:subscribe');
      socket.emit('join:admin');
    });

    // Listen for standard notifications
    socket.on('notification:new', (notification: any) => {
      loadNotifications();
    });

    // Also listen for minting updates (broadcasted globally)
    socket.on('minting:update', (data: any) => {
      loadNotifications();
    });

    void socket.connect();

    return () => {
      socket.off('notification:new');
      socket.off('minting:update');
      socket.off('connect');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.userId, loadNotifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'tutor_registered':
        return { icon: 'ri-user-add-line', class: 'info' };
      case 'exam_passed':
        return { icon: 'ri-checkbox-circle-line', class: 'success' };
      case 'exam_failed':
        return { icon: 'ri-error-warning-line', class: 'warning' };
      case 'student_joined':
        return { icon: 'ri-graduation-cap-line', class: 'info' };
      case 'booking':
        return { icon: 'ri-calendar-check-line', class: 'success' };
      case 'profile_submitted':
        return { icon: 'ri-user-settings-line', class: 'primary' };
      case 'profile_change_submitted':
        return { icon: 'ri-user-settings-line', class: 'primary' };
      case 'minting_started':
        return { icon: 'ri-loader-4-line', class: 'info' };
      case 'minting_success':
        return { icon: 'ri-nft-line', class: 'success' };
      case 'minting_failed':
        return { icon: 'ri-error-warning-line', class: 'error' };
      default:
        return { icon: 'ri-notification-3-line', class: 'info' };
    }
  };

  const getInitials = () => {
    if (!user) return 'AD';
    // Use first 2 chars of username
    if (user.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    return 'AD';
  };

  const getDisplayName = () => {
    if (!user) return 'Admin';
    return user.username || 'Admin';
  };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <button type="button" id="admin-navigation-toggle" className="header-btn admin-navigation-toggle" aria-label={navigationOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={navigationOpen} aria-controls="admin-navigation" onClick={onToggleNavigation}><i className={navigationOpen ? 'ri-close-line' : 'ri-menu-line'} aria-hidden="true" /></button>
        <nav className="admin-breadcrumb" aria-label="Breadcrumb"><a href="/">Workspace</a><i className="ri-arrow-right-s-line" aria-hidden="true" /><span aria-current="page">{pageNames[path] || 'Management'}</span></nav>
      </div>

      <div className="header-right">
        <a href="/platform-overview" className="header-btn" title="Platform overview" aria-label="Platform overview">
          <i className="ri-question-line"></i>
        </a>
        
        <div className="notification-wrapper" ref={notificationRef}>
          <button 
            className="header-btn notification-btn"
            aria-label="Activity feed"
            aria-expanded={showNotifications}
            onClick={() => setShowNotifications(!showNotifications)}
          >
            <i className="ri-notification-3-line"></i>
            {notifications.length > 0 && <span className="notification-dot"></span>}
          </button>
          
          {showNotifications && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <span>Activity Feed</span>
                <button className="mark-read-btn" onClick={loadNotifications}>
                  <i className="ri-refresh-line"></i> Refresh
                </button>
              </div>
              <div className="notification-list">
                {loading && notifications.length === 0 ? (
                  <div className="notification-empty">
                    <i className="ri-loader-4-line spin"></i>
                    <p>Loading...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="notification-empty">
                    <i className="ri-notification-off-line"></i>
                    <p>No recent activity</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const iconInfo = getNotificationIcon(notification.type);
                    return (
                      <div key={notification.id} className="notification-item">
                        <div className={`notification-icon ${iconInfo.class}`}>
                          <i className={iconInfo.icon}></i>
                        </div>
                        <div className="notification-content">
                          <p>{notification.message}</p>
                          <ActivityTimestamp timestamp={notification.timestamp} now={now} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="notification-footer">
                <span className="notification-count">{notifications.length} recent activities</span>
              </div>
            </div>
          )}
        </div>

        <div className="header-divider"></div>

        <div className="header-user-wrapper" ref={userMenuRef}>
          <button type="button"
            className="header-user"
            aria-label="Account menu"
            aria-expanded={showUserMenu}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="avatar">
              <span>{getInitials()}</span>
            </div>
            <div className="user-info">
              <span className="user-name">{getDisplayName()}</span>
              <span className="user-role">{user?.role || 'admin'}</span>
            </div>
            <i className={`ri-arrow-${showUserMenu ? 'up' : 'down'}-s-line`}></i>
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="avatar large">
                  <span>{getInitials()}</span>
                </div>
                <div className="user-dropdown-info">
                  <span className="user-dropdown-name">{getDisplayName()}</span>
                  <span className="user-dropdown-username">@{user?.username}</span>
                </div>
              </div>
              <div className="user-dropdown-divider"></div>
              <a href="/settings" className="user-dropdown-item">
                <i className="ri-settings-3-line"></i>
                Settings
              </a>
              <button className="user-dropdown-item" onClick={handleLogout}>
                <i className="ri-logout-box-r-line"></i>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
