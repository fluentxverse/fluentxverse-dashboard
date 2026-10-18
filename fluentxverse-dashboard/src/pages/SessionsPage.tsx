import { useState, useEffect } from 'preact/hooks';
import { adminApi, SessionListItem, SessionStats, SessionDetails } from '../api/admin.api';
import SessionAvatar from '../components/SessionAvatar';
import './SessionsPage.css';

type SessionStatus = 'all' | 'confirmed' | 'completed' | 'cancelled';

const SessionsPage = () => {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatus>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Session detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  const limit = 15;

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadSessions();
  }, [page, statusFilter, startDate, endDate]);

  const loadStats = async () => {
    try {
      const statsData = await adminApi.getSessionStats();
      setStats(statsData);
    } catch (err: any) {
      console.error('Failed to load session stats:', err);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminApi.getSessions({
        page,
        limit,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setSessions(result.sessions);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: Event) => {
    e.preventDefault();
    setPage(1);
    loadSessions();
  };

  const handleFilterChange = (newFilter: SessionStatus) => {
    setStatusFilter(newFilter);
    setPage(1);
  };

  const handleDateChange = () => {
    setPage(1);
    loadSessions();
  };

  const openSessionDetail = async (sessionId: string) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const details = await adminApi.getSessionDetails(sessionId);
      setSelectedSession(details);
    } catch (err: any) {
      setError(err.message || 'Failed to load session details');
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedSession(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Convert JST time to Manila time (Manila is 1 hour behind JST)
  const convertJSTToManila = (timeStr: string): string => {
    // Parse time like "11:30 PM" or "10:00 AM"
    const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return timeStr;
    
    let hours = parseInt(match[1]);
    const minutes = match[2];
    const period = match[3].toUpperCase();
    
    // Convert to 24-hour format
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    // Subtract 1 hour for Manila time
    hours = hours - 1;
    if (hours < 0) hours = 23;
    
    // Convert back to 12-hour format
    const newPeriod = hours >= 12 ? 'PM' : 'AM';
    let displayHours = hours % 12;
    if (displayHours === 0) displayHours = 12;
    
    return `${displayHours}:${minutes} ${newPeriod}`;
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    
    // Try parsing the date
    const date = new Date(dateStr);
    
    // Check if valid date
    if (isNaN(date.getTime())) {
      // Try to parse if it's a Neo4j date format or timestamp
      const timestamp = parseInt(dateStr);
      if (!isNaN(timestamp)) {
        const timestampDate = new Date(timestamp);
        if (!isNaN(timestampDate.getTime())) {
          return timestampDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Manila'
          }) + ' PHT';
        }
      }
      return 'N/A';
    }
    
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila'
    }) + ' PHT';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="status-badge confirmed"><i className="ri-calendar-check-line"></i> Upcoming</span>;
      case 'completed':
        return <span className="status-badge completed"><i className="ri-check-double-line"></i> Completed</span>;
      case 'cancelled':
        return <span className="status-badge cancelled"><i className="ri-close-circle-line"></i> Cancelled</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getAttendanceBadge = (attendance: string | null) => {
    if (!attendance) return <span className="attendance-badge pending">Pending</span>;
    if (attendance === 'present') return <span className="attendance-badge present"><i className="ri-checkbox-circle-line"></i> Present</span>;
    if (attendance === 'absent') return <span className="attendance-badge absent"><i className="ri-close-circle-line"></i> Absent</span>;
    return <span className="attendance-badge">{attendance}</span>;
  };

  return (
    <div className="sessions-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <div className="header-icon">
            <i className="ri-video-chat-line"></i>
          </div>
          <div>
            <h1>Sessions</h1>
            <p>Track and manage all tutoring sessions</p>
          </div>
        </div>
        <button className="btn-refresh" onClick={() => { loadStats(); loadSessions(); }}>
          <i className="ri-refresh-line"></i>
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon total">
              <i className="ri-calendar-line"></i>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.totalBookings}</span>
              <span className="stat-label">Total Bookings</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon completed">
              <i className="ri-check-double-line"></i>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.completedSessions}</span>
              <span className="stat-label">Completed</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon upcoming">
              <i className="ri-time-line"></i>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.upcomingSessions}</span>
              <span className="stat-label">Upcoming</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon cancelled">
              <i className="ri-close-circle-line"></i>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.cancelledSessions}</span>
              <span className="stat-label">Cancelled</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon today">
              <i className="ri-calendar-todo-line"></i>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.todaySessions}</span>
              <span className="stat-label">Today</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon hours">
              <i className="ri-timer-line"></i>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.totalHours}h</span>
              <span className="stat-label">Total Hours</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon rate">
              <i className="ri-percent-line"></i>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.completionRate}%</span>
              <span className="stat-label">Completion Rate</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon noshow">
              <i className="ri-user-unfollow-line"></i>
            </div>
            <div className="stat-info">
              <span className="stat-value">{stats.noShowSessions}</span>
              <span className="stat-label">No-Shows</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-input-wrapper">
            <i className="ri-search-line"></i>
            <input
              type="text"
              placeholder="Search by tutor or student name..."
              value={searchQuery}
              onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          <button type="submit" className="btn-search">Search</button>
        </form>

        <div className="filter-group">
          <div className="status-tabs">
            <button 
              className={`tab ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              All
            </button>
            <button 
              className={`tab ${statusFilter === 'confirmed' ? 'active' : ''}`}
              onClick={() => handleFilterChange('confirmed')}
            >
              <i className="ri-calendar-check-line"></i> Upcoming
            </button>
            <button 
              className={`tab ${statusFilter === 'completed' ? 'active' : ''}`}
              onClick={() => handleFilterChange('completed')}
            >
              <i className="ri-check-double-line"></i> Completed
            </button>
            <button 
              className={`tab ${statusFilter === 'cancelled' ? 'active' : ''}`}
              onClick={() => handleFilterChange('cancelled')}
            >
              <i className="ri-close-circle-line"></i> Cancelled
            </button>
          </div>

          <div className="date-filters">
            <div className="date-input">
              <label>From</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => { setStartDate((e.target as HTMLInputElement).value); handleDateChange(); }}
              />
            </div>
            <div className="date-input">
              <label>To</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => { setEndDate((e.target as HTMLInputElement).value); handleDateChange(); }}
              />
            </div>
            {(startDate || endDate) && (
              <button className="btn-clear-dates" onClick={() => { setStartDate(''); setEndDate(''); handleDateChange(); }}>
                <i className="ri-close-line"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <i className="ri-error-warning-line"></i>
          {error}
          <button onClick={() => setError('')}><i className="ri-close-line"></i></button>
        </div>
      )}

      {/* Sessions Table */}
      <div className="sessions-table-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty-state">
            <i className="ri-calendar-line"></i>
            <h3>No sessions found</h3>
            <p>Try adjusting your filters or search query</p>
          </div>
        ) : (
          <>
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Tutor</th>
                  <th>Student</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Attendance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="datetime-cell">
                      <div className="date">{formatDate(session.slotDate)}</div>
                      <div className="time">{session.slotTime} JST</div>
                    </td>
                    <td className="user-cell">
                      <div className="session-user">
                        <SessionAvatar src={session.tutorAvatar} name={session.tutorName} kind="tutor" />
                        <div className="user-info">
                          <span className="user-name">{session.tutorName}</span>
                          <span className="user-email">{session.tutorEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="user-cell">
                      <div className="session-user">
                        <SessionAvatar src={session.studentAvatar} name={session.studentName} kind="student" />
                        <div className="user-info">
                          <span className="user-name">{session.studentName}</span>
                          <span className="user-email">{session.studentEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td className="duration-cell">
                      {session.durationMinutes} min
                    </td>
                    <td>
                      {getStatusBadge(session.status)}
                    </td>
                    <td className="attendance-cell">
                      <div className="attendance-row">
                        <span className="attendance-label">T:</span>
                        {getAttendanceBadge(session.attendanceTutor)}
                      </div>
                      <div className="attendance-row">
                        <span className="attendance-label">S:</span>
                        {getAttendanceBadge(session.attendanceStudent)}
                      </div>
                    </td>
                    <td>
                      <button 
                        className="btn-view" 
                        onClick={() => openSessionDetail(session.id)}
                        title="View Details"
                      >
                        <i className="ri-eye-line"></i>
                      </button>
                      <a className="btn-view" title="Lesson operations" aria-label="Lesson operations" href={`/lesson-operations/${encodeURIComponent(session.id)}`}><i className="ri-arrow-right-line" /></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="pagination">
                <span className="pagination-info">
                  Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total}
                </span>
                <div className="pagination-buttons">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    <i className="ri-arrow-left-s-line"></i>
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        className={page === pageNum ? 'active' : ''}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button 
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Session Detail Modal */}
      {showDetailModal && (
        <div className="modal-overlay" onClick={closeDetailModal}>
          <div className="modal-content session-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><i className="ri-video-chat-line"></i> Session Details</h2>
              <button className="modal-close" onClick={closeDetailModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              {detailLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading details...</p>
                </div>
              ) : selectedSession ? (
                <div className="session-detail-content">
                  {/* Status Banner */}
                  <div className={`status-banner ${selectedSession.status}`}>
                    {getStatusBadge(selectedSession.status)}
                    {selectedSession.cancelReason && (
                      <span className="cancel-reason">Reason: {selectedSession.cancelReason}</span>
                    )}
                  </div>

                  {/* Participants */}
                  <div className="detail-section">
                    <h3><i className="ri-group-line"></i> Participants</h3>
                    <div className="participants-grid">
                      <div className="participant-card tutor">
                        <div className="participant-header">
                          <span className="participant-role">Tutor</span>
                          {getAttendanceBadge(selectedSession.attendance.tutor)}
                        </div>
                        <div className="participant-info">
                          <SessionAvatar src={selectedSession.tutor.avatar} name={selectedSession.tutor.name} kind="tutor" detail />
                          <div>
                            <span className="participant-name">{selectedSession.tutor.name}</span>
                            <span className="participant-email">{selectedSession.tutor.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="participant-card student">
                        <div className="participant-header">
                          <span className="participant-role">Student</span>
                          {getAttendanceBadge(selectedSession.attendance.student)}
                        </div>
                        <div className="participant-info">
                          <SessionAvatar src={selectedSession.student.avatar} name={selectedSession.student.name} kind="student" detail />
                          <div>
                            <span className="participant-name">{selectedSession.student.name}</span>
                            <span className="participant-email">{selectedSession.student.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="detail-section">
                    <h3><i className="ri-calendar-line"></i> Schedule</h3>
                    <div className="schedule-info">
                      <div className="schedule-row">
                        <span className="label"><i className="ri-calendar-event-line"></i> Date</span>
                        <span className="value">{formatDate(selectedSession.schedule.date)}</span>
                      </div>
                      <div className="schedule-row">
                        <span className="label"><i className="ri-time-line"></i> Time</span>
                        <span className="value">
                          {selectedSession.schedule.time} PHT
                        </span>
                      </div>
                      <div className="schedule-row">
                        <span className="label"><i className="ri-timer-line"></i> Duration</span>
                        <span className="value">{selectedSession.schedule.durationMinutes} minutes</span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div className="detail-section">
                    <h3><i className="ri-history-line"></i> Timeline</h3>
                    <div className="timeline">
                      <div className="timeline-item">
                        <div className="timeline-dot booked"></div>
                        <div className="timeline-content">
                          <span className="timeline-label">Booked</span>
                          <span className="timeline-time">{formatDateTime(selectedSession.timestamps.bookedAt)}</span>
                        </div>
                      </div>
                      {selectedSession.timestamps.completedAt && (
                        <div className="timeline-item">
                          <div className="timeline-dot completed"></div>
                          <div className="timeline-content">
                            <span className="timeline-label">Completed</span>
                            <span className="timeline-time">{formatDateTime(selectedSession.timestamps.completedAt)}</span>
                          </div>
                        </div>
                      )}
                      {selectedSession.timestamps.cancelledAt && (
                        <div className="timeline-item">
                          <div className="timeline-dot cancelled"></div>
                          <div className="timeline-content">
                            <span className="timeline-label">Cancelled</span>
                            <span className="timeline-time">{formatDateTime(selectedSession.timestamps.cancelledAt)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Additional Info */}
                  {selectedSession.ticketUsed && (
                    <div className="detail-section">
                      <h3><i className="ri-ticket-2-line"></i> Ticket</h3>
                      <div className="ticket-info">
                        <span className="ticket-id">{selectedSession.ticketUsed}</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="error-state">
                  <i className="ri-error-warning-line"></i>
                  <p>Failed to load session details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsPage;
