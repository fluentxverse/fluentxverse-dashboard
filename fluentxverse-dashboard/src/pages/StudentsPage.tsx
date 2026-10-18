import { useState, useEffect } from 'preact/hooks';
import { adminApi, StudentListItem, SuspensionHistoryItem } from '../api/admin.api';
import './StudentsPage.css';

type StudentStatus = 'all' | 'active' | 'inactive' | 'suspended';

const StudentsPage = () => {
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<StudentStatus>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Suspend modal state
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendingStudent, setSuspendingStudent] = useState<StudentListItem | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);
  
  // View profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<StudentListItem | null>(null);
  
  // Suspension history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<StudentListItem | null>(null);
  const [suspensionHistory, setSuspensionHistory] = useState<SuspensionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const limit = 12;

  useEffect(() => {
    loadStudents();
  }, [page, filter]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await adminApi.getStudents({
        page,
        limit,
        status: filter,
        search: searchQuery || undefined,
      });
      setStudents(result.students);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: Event) => {
    e.preventDefault();
    setPage(1);
    loadStudents();
  };

  const handleFilterChange = (newFilter: StudentStatus) => {
    setFilter(newFilter);
    setPage(1);
  };

  const openSuspendModal = (student: StudentListItem) => {
    setSuspendingStudent(student);
    setSuspendReason('');
    setSuspendUntil('');
    setShowSuspendModal(true);
  };

  const closeSuspendModal = () => {
    setShowSuspendModal(false);
    setSuspendingStudent(null);
    setSuspendReason('');
    setSuspendUntil('');
  };

  const handleSuspendStudent = async () => {
    if (!suspendingStudent || !suspendReason.trim() || !suspendUntil) return;
    
    try {
      setSuspendLoading(true);
      await adminApi.suspendStudent(suspendingStudent.id, suspendReason.trim(), suspendUntil);
      closeSuspendModal();
      setSuccessMessage(`${suspendingStudent.name} has been suspended successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadStudents();
    } catch (err: any) {
      setError(err.message || 'Failed to suspend student');
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleUnsuspendStudent = async (student: StudentListItem) => {
    try {
      await adminApi.unsuspendStudent(student.id);
      setSuccessMessage(`${student.name} has been unsuspended successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadStudents();
    } catch (err: any) {
      setError(err.message || 'Failed to unsuspend student');
    }
  };

  const openProfileModal = (student: StudentListItem) => {
    setViewingStudent(student);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setViewingStudent(null);
  };

  const openHistoryModal = async (student: StudentListItem) => {
    setHistoryStudent(student);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const history = await adminApi.getStudentSuspensionHistory(student.id);
      setSuspensionHistory(history);
    } catch (err: any) {
      setError(err.message || 'Failed to load suspension history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryStudent(null);
    setSuspensionHistory([]);
  };

  const stats = {
    total: total,
    active: students.filter(s => s.status === 'active').length,
    totalRevenue: students.reduce((sum, s) => sum + s.totalSpent, 0),
    totalSessions: students.reduce((sum, s) => sum + s.totalSessions, 0)
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="students-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Students Management</h1>
          <p>View and manage student accounts</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="quick-stat">
          <div className="stat-icon blue">
            <i className="ri-group-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{total}</span>
            <span className="stat-label">Total Students</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon green">
            <i className="ri-user-follow-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.active}</span>
            <span className="stat-label">Active Students</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon purple">
            <i className="ri-calendar-check-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.totalSessions}</span>
            <span className="stat-label">Total Sessions</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon yellow">
            <i className="ri-money-dollar-circle-line"></i>
          </div>
          <div className="stat-info">
            <span className="stat-number">${stats.totalRevenue.toLocaleString()}</span>
            <span className="stat-label">Total Revenue</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <i className="ri-check-line"></i>
          {successMessage}
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <form className="search-box" onSubmit={handleSearch}>
          <i className="ri-search-line"></i>
          <input 
            type="text" 
            placeholder="Search students..." 
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
          <button type="submit" className="btn-search">Search</button>
        </form>
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('all')}
          >
            All Students
          </button>
          <button 
            className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
            onClick={() => handleFilterChange('active')}
          >
            Active
          </button>
          <button 
            className={`filter-tab ${filter === 'inactive' ? 'active' : ''}`}
            onClick={() => handleFilterChange('inactive')}
          >
            Inactive
          </button>
          <button 
            className={`filter-tab ${filter === 'suspended' ? 'active' : ''}`}
            onClick={() => handleFilterChange('suspended')}
          >
            <i className="ri-forbid-line"></i>
            Suspended
          </button>
        </div>
      </div>

      {/* Students Grid */}
      {loading ? (
        <div className="loading-state">
          <i className="ri-loader-4-line spinning"></i>
          <span>Loading students...</span>
        </div>
      ) : (
        <div className="students-grid">
          {students.map(student => (
            <div className={`student-card ${student.isSuspended ? 'suspended' : ''}`} key={student.id}>
              <div className="student-header">
                <div className={`student-avatar ${student.isSuspended ? 'suspended' : ''}`}>
                  <span>{student.name?.charAt(0) || 'S'}</span>
                  <span className={`status-dot ${student.isSuspended ? 'suspended' : student.status}`}></span>
                </div>
                <div className="student-info">
                  <h3>
                    {student.name}
                    {student.isSuspended && (
                      <span className="suspended-badge">
                        <i className="ri-forbid-line"></i>
                      </span>
                    )}
                  </h3>
                  <p>{student.email}</p>
                </div>
              </div>
              
              {student.isSuspended && (
                <div className="suspension-banner">
                  <i className="ri-forbid-line"></i>
                  Suspended until {formatDate(student.suspendedUntil!)}
                </div>
              )}
              
              <div className="student-stats">
                <div className="stat-item">
                  <span className="stat-value">{student.totalSessions}</span>
                  <span className="stat-label">Sessions</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">${student.totalSpent.toFixed(2)}</span>
                  <span className="stat-label">Spent</span>
                </div>
              </div>

              <div className="student-meta">
                <span className="joined-date">
                  <i className="ri-calendar-line"></i>
                  Joined {formatDate(student.joinedAt)}
                </span>
              </div>

              <div className="student-footer">
                <span className="last-active">
                  <i className="ri-time-line"></i> {student.lastActive}
                </span>
                <div className="actions">
                  <a className="action-btn" title="Operations detail" aria-label="Operations detail" href={`/operations/people/student/${encodeURIComponent(student.id)}`}><i className="ri-dashboard-line" /></a>
                  <button 
                    className="action-btn" 
                    title="View Profile"
                    onClick={() => openProfileModal(student)}
                  >
                    <i className="ri-eye-line"></i>
                  </button>
                  <button 
                    className="action-btn history" 
                    title="Suspension History"
                    onClick={() => openHistoryModal(student)}
                  >
                    <i className="ri-history-line"></i>
                  </button>
                  <button className="action-btn" title="Message">
                    <i className="ri-mail-line"></i>
                  </button>
                  {student.isSuspended ? (
                    <button 
                      className="action-btn unsuspend" 
                      title="Unsuspend"
                      onClick={() => handleUnsuspendStudent(student)}
                    >
                      <i className="ri-checkbox-circle-line"></i>
                    </button>
                  ) : (
                    <button 
                      className="action-btn suspend" 
                      title="Suspend"
                      onClick={() => openSuspendModal(student)}
                    >
                      <i className="ri-forbid-line"></i>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && students.length === 0 && (
        <div className="empty-state">
          <i className="ri-user-search-line"></i>
          <p>No students found matching your criteria</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            <i className="ri-arrow-left-s-line"></i>
            Previous
          </button>
          <div className="pagination-info">
            Page {page} of {totalPages}
          </div>
          <button
            className="pagination-btn"
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            Next
            <i className="ri-arrow-right-s-line"></i>
          </button>
        </div>
      )}

      {/* Suspend Modal */}
      {showSuspendModal && suspendingStudent && (
        <div className="modal-overlay" onClick={closeSuspendModal}>
          <div className="suspend-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-forbid-line"></i> Suspend Student</h3>
              <button className="modal-close" onClick={closeSuspendModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="suspend-user-info">
                <div className="user-avatar">
                  <span>{suspendingStudent.name?.charAt(0) || 'S'}</span>
                </div>
                <div className="user-details">
                  <span className="user-name">{suspendingStudent.name}</span>
                  <span className="user-email">{suspendingStudent.email}</span>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="suspendReason">Suspension Reason *</label>
                <textarea
                  id="suspendReason"
                  placeholder="Enter the reason for suspension..."
                  value={suspendReason}
                  onInput={(e) => setSuspendReason((e.target as HTMLTextAreaElement).value)}
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="suspendUntil">Suspend Until *</label>
                <input
                  type="date"
                  id="suspendUntil"
                  value={suspendUntil}
                  onInput={(e) => setSuspendUntil((e.target as HTMLInputElement).value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeSuspendModal}>
                Cancel
              </button>
              <button 
                className="btn-suspend" 
                onClick={handleSuspendStudent}
                disabled={!suspendReason.trim() || !suspendUntil || suspendLoading}
              >
                {suspendLoading ? (
                  <><i className="ri-loader-4-line spinning"></i> Suspending...</>
                ) : (
                  <><i className="ri-forbid-line"></i> Suspend Student</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {showProfileModal && viewingStudent && (
        <div className="modal-overlay" onClick={closeProfileModal}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-user-line"></i> Student Profile</h3>
              <button className="modal-close" onClick={closeProfileModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="profile-header">
                <div className={`profile-avatar ${viewingStudent.isSuspended ? 'suspended' : ''}`}>
                  <span>{viewingStudent.name?.charAt(0) || 'S'}</span>
                </div>
                <div className="profile-info">
                  <h2>{viewingStudent.name}</h2>
                  <p>{viewingStudent.email}</p>
                  {viewingStudent.isSuspended && (
                    <span className="profile-suspended-badge">
                      <i className="ri-forbid-line"></i> Suspended until {formatDate(viewingStudent.suspendedUntil!)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Account Status</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Status</span>
                    <span className={`value status-${viewingStudent.status}`}>
                      {viewingStudent.isSuspended ? 'Suspended' : viewingStudent.status.charAt(0).toUpperCase() + viewingStudent.status.slice(1)}
                    </span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Joined</span>
                    <span className="value">{formatDate(viewingStudent.joinedAt)}</span>
                  </div>
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Activity Stats</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Total Sessions</span>
                    <span className="value">{viewingStudent.totalSessions}</span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Total Spent</span>
                    <span className="value">${viewingStudent.totalSpent.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {viewingStudent.isSuspended && (
                <div className="profile-section suspension-section">
                  <h4><i className="ri-error-warning-line"></i> Suspension Details</h4>
                  <div className="suspension-details">
                    <div className="suspension-item">
                      <span className="label">Suspended Until</span>
                      <span className="value">{formatDate(viewingStudent.suspendedUntil!)}</span>
                    </div>
                    <div className="suspension-item">
                      <span className="label">Reason</span>
                      <span className="value reason">{viewingStudent.suspendedReason}</span>
                    </div>
                    {viewingStudent.suspendedAt && (
                      <div className="suspension-item">
                        <span className="label">Suspended On</span>
                        <span className="value">{formatDate(viewingStudent.suspendedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeProfileModal}>
                Close
              </button>
              {viewingStudent.isSuspended ? (
                <button 
                  className="btn-unsuspend" 
                  onClick={() => {
                    handleUnsuspendStudent(viewingStudent);
                    closeProfileModal();
                  }}
                >
                  <i className="ri-checkbox-circle-line"></i> Unsuspend Student
                </button>
              ) : (
                <button 
                  className="btn-suspend" 
                  onClick={() => {
                    closeProfileModal();
                    openSuspendModal(viewingStudent);
                  }}
                >
                  <i className="ri-forbid-line"></i> Suspend Student
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suspension History Modal */}
      {showHistoryModal && historyStudent && (
        <div className="modal-overlay" onClick={closeHistoryModal}>
          <div className="modal-content history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-history-line"></i> Suspension History</h3>
              <button className="modal-close" onClick={closeHistoryModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="history-user-info">
                <div className="history-avatar">
                  <span>{historyStudent.name?.charAt(0) || 'S'}</span>
                </div>
                <div className="history-details">
                  <span className="history-name">{historyStudent.name}</span>
                  <span className="history-email">{historyStudent.email}</span>
                </div>
              </div>
              
              {historyLoading ? (
                <div className="history-loading">
                  <i className="ri-loader-4-line spinning"></i>
                  <span>Loading history...</span>
                </div>
              ) : suspensionHistory.length === 0 ? (
                <div className="history-empty">
                  <i className="ri-shield-check-line"></i>
                  <p>No suspension history for this student</p>
                </div>
              ) : (
                <div className="history-timeline">
                  {suspensionHistory.map((item, index) => (
                    <div key={item.id} className={`history-item ${item.action}`}>
                      <div className="history-icon">
                        {item.action === 'suspended' && <i className="ri-forbid-line"></i>}
                        {item.action === 'unsuspended' && <i className="ri-checkbox-circle-line"></i>}
                        {item.action === 'auto-unsuspended' && <i className="ri-time-line"></i>}
                      </div>
                      <div className="history-content">
                        <div className="history-action">
                          {item.action === 'suspended' && 'Suspended'}
                          {item.action === 'unsuspended' && 'Unsuspended'}
                          {item.action === 'auto-unsuspended' && 'Auto-Unsuspended'}
                        </div>
                        <div className="history-date">{formatDate(item.createdAt)}</div>
                        <div className="history-reason">{item.reason}</div>
                        {item.until && item.action === 'suspended' && (
                          <div className="history-until">
                            <i className="ri-calendar-line"></i> Until: {formatDate(item.until)}
                          </div>
                        )}
                        {item.suspendedBy && (
                          <div className="history-by">
                            <i className="ri-user-line"></i> By: {item.suspendedBy}
                          </div>
                        )}
                        {item.unsuspendedBy && (
                          <div className="history-by">
                            <i className="ri-user-line"></i> By: {item.unsuspendedBy}
                          </div>
                        )}
                      </div>
                      {index < suspensionHistory.length - 1 && <div className="history-line"></div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={closeHistoryModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;
