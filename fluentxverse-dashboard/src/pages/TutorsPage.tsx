import { useState, useEffect } from 'preact/hooks';
import { adminApi, TutorListItem, SuspensionHistoryItem } from '../api/admin.api';
import './TutorsPage.css';
import { AdminArt } from '../components/AdminArt';
import { operations, operationError } from '../api/operations.api';
import { compensationApi, usdRateLabel } from '../api/compensation.api';
import type { TutorCompensation } from '../../../fluentxverse-server/src/shared/tutorCompensation';
import { OperationsAccountModal } from '../components/OperationsAccountModal';
import { OperationsAction, dateText } from '../components/OperationsShared';
import ProfileAvatar from '../components/ProfileAvatar';

type TabType = 'certified' | 'all' | 'suspended';
import { API_BASE_URL } from '../config/api';

const bookingBlocked = (tutor: TutorListItem) => tutor.isBlocked === true
  && !(tutor.blockExpiresAt && Date.parse(tutor.blockExpiresAt) <= Date.now());

const TutorsPage = ({ initialAccount, onAccountClose }: { initialAccount?: { id: string; tab: string }; onAccountClose?: () => void }) => {
  const [account, setAccount] = useState(initialAccount || null);
  const closeAccount = () => { setAccount(null); setRatesRefresh(value => value + 1); void loadTutors(); onAccountClose?.(); };
  const [tutors, setTutors] = useState<TutorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>('certified');
  const [hasFinance, setHasFinance] = useState(false);
  const [hasOperations, setHasOperations] = useState(false);
  const [unblockingTutor, setUnblockingTutor] = useState<TutorListItem | null>(null);
  const [rates, setRates] = useState<Record<string, TutorCompensation>>({});
  const [ratesError, setRatesError] = useState('');
  const [ratesRefresh, setRatesRefresh] = useState(0);
  
  // Suspend modal state
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendingTutor, setSuspendingTutor] = useState<TutorListItem | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendUntil, setSuspendUntil] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);
  
  // View profile modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [viewingTutor, setViewingTutor] = useState<TutorListItem | null>(null);
  
  // Suspension history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTutor, setHistoryTutor] = useState<TutorListItem | null>(null);
  const [suspensionHistory, setSuspensionHistory] = useState<SuspensionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [retryingProofTutorId, setRetryingProofTutorId] = useState<string | null>(null);
  
  const limit = 15;

  useEffect(() => {
    let active = true;
    operations('/access').then(access => {
      if (active) { setHasFinance(access.permissions.includes('finance')); setHasOperations(access.permissions.includes('operations')); }
    }).catch(() => { if (active) { setHasFinance(false); setHasOperations(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setRates({}); setRatesError('');
    if (hasFinance && tutors.length) compensationApi.summaries(tutors.map(tutor => tutor.id))
      .then(items => { if (active) setRates(Object.fromEntries(items.map(item => [item.tutorId, item]))); })
      .catch(failure => { if (active) setRatesError(operationError(failure)); });
    return () => { active = false; };
  }, [hasFinance, tutors, ratesRefresh]);

  useEffect(() => {
    loadTutors();
  }, [page, activeTab]);

  const loadTutors = async () => {
    try {
      setLoading(true);
      setError('');
      const statusMap: Record<TabType, string> = {
        'certified': 'certified',
        'all': 'all',
        'suspended': 'suspended'
      };
      const result = await adminApi.getTutors({
        page,
        limit,
        status: statusMap[activeTab] as any,
        search: searchQuery || undefined,
      });
      setTutors(result.tutors);
      setTotal(result.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load tutors');
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setPage(1);
  };

  const openSuspendModal = (tutor: TutorListItem) => {
    setSuspendingTutor(tutor);
    setSuspendReason('');
    setSuspendUntil('');
    setShowSuspendModal(true);
  };

  const closeSuspendModal = () => {
    setShowSuspendModal(false);
    setSuspendingTutor(null);
    setSuspendReason('');
    setSuspendUntil('');
  };

  const handleSuspendTutor = async () => {
    if (!suspendingTutor || !suspendReason.trim() || !suspendUntil) return;
    
    try {
      setSuspendLoading(true);
      await adminApi.suspendTutor(suspendingTutor.id, suspendReason.trim(), suspendUntil);
      closeSuspendModal();
      setSuccessMessage(`${suspendingTutor.name} has been suspended successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadTutors(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to suspend tutor');
    } finally {
      setSuspendLoading(false);
    }
  };

  const handleUnsuspendTutor = async (tutor: TutorListItem) => {
    try {
      await adminApi.unsuspendTutor(tutor.id);
      setSuccessMessage(`${tutor.name} has been unsuspended successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      loadTutors(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Failed to unsuspend tutor');
    }
  };

  const handleRetryProof = async (tutor: TutorListItem) => {
    try {
      setRetryingProofTutorId(tutor.id);
      setError('');
      await adminApi.retryTutorProofSubmission(tutor.id);
      setSuccessMessage(`zkVerify proof submission restarted for ${tutor.name}.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      await loadTutors();
    } catch (err: any) {
      setError(err.message || 'Failed to retry zkVerify proof submission');
    } finally {
      setRetryingProofTutorId(null);
    }
  };

  const openProfileModal = (tutor: TutorListItem) => {
    setViewingTutor(tutor);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setViewingTutor(null);
  };

  const openHistoryModal = async (tutor: TutorListItem) => {
    setHistoryTutor(tutor);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const history = await adminApi.getTutorSuspensionHistory(tutor.id);
      setSuspensionHistory(history);
    } catch (err: any) {
      setError(err.message || 'Failed to load suspension history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryTutor(null);
    setSuspensionHistory([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleSearch = (e: Event) => {
    e.preventDefault();
    setPage(1);
    loadTutors();
  };

  const getStatusBadge = (tutor: TutorListItem) => {
    if (tutor.status === 'test_qualified') {
      return <span className="status-badge processing" title="Manual qualification for salary testing; screening results are unchanged"><i className="ri-flask-line"></i> Test Qualified</span>;
    }
    if (tutor.status === 'certified') {
      return <span className="status-badge certified"><i className="ri-shield-check-line"></i> Certified</span>;
    } else if (tutor.status === 'pending_profile') {
      return <span className="status-badge pending-profile"><i className="ri-user-search-line"></i> Pending Profile Review</span>;
    } else if (tutor.status === 'processing') {
      return <span className="status-badge processing"><i className="ri-loader-4-line"></i> Processing</span>;
    } else if (tutor.status === 'failed') {
      return <span className="status-badge failed"><i className="ri-close-circle-line"></i> Failed</span>;
    } else {
      if (!tutor.writtenExamPassed) {
        return <span className="status-badge pending"><i className="ri-file-text-line"></i> Pending Written</span>;
      } else {
        return <span className="status-badge pending-speaking"><i className="ri-mic-line"></i> Pending Speaking</span>;
      }
    }
  };

  const getProofStatusBadge = (tutor: TutorListItem) => {
    const status = tutor.zkCertificationStatus || (
      'retired'
    );
    const statusClass = status.replace(/_/g, '-');

    const labels: Record<string, { icon: string; label: string }> = {
      retired: { icon: 'ri-shield-line', label: 'Retired' },
      expired: { icon: 'ri-time-line', label: 'Expired' },
      revoked: { icon: 'ri-close-circle-line', label: 'Revoked' },
      requirements_incomplete: { icon: 'ri-time-line', label: 'Incomplete' },
      ready_for_proving: { icon: 'ri-flask-line', label: 'Ready' },
      local_proof_generated: { icon: 'ri-shield-keyhole-line', label: 'Local Proof' },
      submitted: { icon: 'ri-send-plane-line', label: 'Submitted' },
      verified: { icon: 'ri-shield-check-line', label: 'Verified' },
      failed: { icon: 'ri-error-warning-line', label: 'Failed' },
    };

    const meta = labels[status] || labels.requirements_incomplete;
    return (
      <div className="proof-status-wrap">
        <span className={`proof-badge proof-badge--${statusClass}`} title={tutor.zkVerifyLastError || undefined}>
          <i className={meta.icon}></i>
          {meta.label}
        </span>
        {tutor.zkVerifyTxHash && tutor.zkCredentialCommitment && (
          <a
            className="proof-tx-link"
            href={`${API_BASE_URL}/proof/tutor-certification/public/${encodeURIComponent(tutor.zkCredentialCommitment || '')}`}
            target="_blank"
            rel="noreferrer"
            title={tutor.zkVerifyTxHash}
          >
            Tx {tutor.zkVerifyTxHash.slice(0, 8)}...
          </a>
        )}
        {tutor.zkVerifyAggregationId != null && (
          <span className="proof-aggregation">Agg #{tutor.zkVerifyAggregationId}</span>
        )}
      </div>
    );
  };

  const canRetryProof = (tutor: TutorListItem) => {
    if (tutor.status !== 'certified') return false;
    return false; // Legacy keys cannot be retried; V2 has its own approval gate.
  };

  const totalPages = Math.ceil(total / limit);

  // Calculate stats from the tutors list
  const avgRating = tutors.length > 0 
    ? (tutors.reduce((sum, t) => sum + (t.rating || 0), 0) / tutors.length).toFixed(1)
    : '0.0';
  const totalSessions = tutors.reduce((sum, t) => sum + (t.totalSessions || 0), 0);

  return (
    <div className="tutors-page">
      <div className="page-header">
        <div className="header-content">
          <AdminArt name="community" className="page-art" />
          <h1>Tutors Management</h1>
          <p>View and manage platform tutors</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tutor-tabs">
        <button
          className={`tutor-tab ${activeTab === 'certified' ? 'active' : ''}`}
          onClick={() => handleTabChange('certified')}
        >
          <i className="ri-shield-check-line" aria-hidden="true"></i>
          Certified Tutors
        </button>
        <button
          className={`tutor-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => handleTabChange('all')}
        >
          <i className="ri-group-line" aria-hidden="true"></i>
          All Tutors
        </button>
        <button
          className={`tutor-tab ${activeTab === 'suspended' ? 'active' : ''}`}
          onClick={() => handleTabChange('suspended')}
        >
          <i className="ri-forbid-line" aria-hidden="true"></i>
          Suspended
        </button>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="quick-stat">
          <div className="stat-icon blue">
            <AdminArt name="community" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{total}</span>
            <span className="stat-label">
              {activeTab === 'certified' ? 'Total Certified' : activeTab === 'suspended' ? 'Suspended Tutors' : 'Total Tutors'}
            </span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon green">
            <AdminArt name="growth" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{avgRating}</span>
            <span className="stat-label">Avg rating · this page</span>
          </div>
        </div>
        <div className="quick-stat">
          <div className="stat-icon purple">
            <AdminArt name="schedule" />
          </div>
          <div className="stat-info">
            <span className="stat-number">{totalSessions}</span>
            <span className="stat-label">Sessions · this page</span>
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

      {/* Search */}
      <div className="filters-bar">
        <form className="search-box" onSubmit={handleSearch}>
          <i className="ri-search-line"></i>
          <input 
            type="text" 
            placeholder={activeTab === 'certified' ? 'Search certified tutors...' : 'Search all tutors...'}
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
          <button type="submit" className="btn-search">Search</button>
        </form>
      </div>

      {/* Tutors Table */}
      {hasFinance && ratesError && <p className="error-message" role="alert">{ratesError} <button type="button" title="Reload base rates" aria-label="Reload base rates" onClick={() => setRatesRefresh(value => value + 1)}><i aria-hidden="true" className="ri-refresh-line" /></button></p>}
      <div className="tutors-table-card" role="region" aria-label="Tutor list" tabIndex={0}>
        {loading ? (
          <div className="loading-state">
            <i className="ri-loader-4-line spinning"></i>
            <span>Loading tutors...</span>
          </div>
        ) : (
          <table key={hasFinance ? 'finance' : 'standard'} className="tutors-table">
            <caption className="sr-only">Tutors, exam results, certification, booking access, sessions, and account actions</caption>
            <colgroup>
              <col className="tutor-column" />
              {hasFinance && <col key="rate" className="rate-column" />}
              <col key="languages" className="languages-column" />
              <col key="written" className="exam-column" />
              <col key="speaking" className="exam-column" />
              <col key="status" className="status-column" />
              <col key="bookings" className="bookings-column" />
              <col key="proof" className="proof-column" />
              <col key="sessions" className="sessions-column" />
              <col key="rating" className="rating-column" />
              <col key="actions" className="actions-column" />
            </colgroup>
            <thead>
              <tr>
                <th key="tutor" scope="col">Tutor</th>
                {hasFinance && <th key="rate" scope="col">Base rate (USD)</th>}
                <th key="languages" scope="col">Languages</th>
                <th key="written" scope="col">Written Exam</th>
                <th key="speaking" scope="col">Speaking Exam</th>
                <th key="status" scope="col">Status</th>
                <th key="bookings" scope="col">Bookings</th>
                <th key="proof" scope="col">ZK Proof</th>
                <th key="sessions" scope="col">Sessions</th>
                <th key="rating" scope="col">Rating</th>
                <th key="actions" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tutors.map(tutor => (
                <tr key={tutor.id} className={tutor.isSuspended ? 'suspended-row' : ''}>
                  <td key="tutor" className="tutor-cell">
                    <div className="tutor-info">
                      <ProfileAvatar src={tutor.profilePicture} name={tutor.name || tutor.email} className={`tutor-avatar ${tutor.isSuspended ? 'suspended' : ''}`}
                        fallback={<span>{tutor.name?.charAt(0) || 'T'}</span>} />
                      <div className="tutor-details">
                        <span className="tutor-name">
                          {tutor.name}
                          {tutor.isSuspended && (
                            <span className="suspended-badge" title={`Suspended until ${formatDate(tutor.suspendedUntil!)}\nReason: ${tutor.suspendedReason}`}>
                              <i className="ri-forbid-line"></i> Suspended
                            </span>
                          )}
                        </span>
                        <span className="tutor-email" title={tutor.email}>{tutor.email}</span>
                      </div>
                    </div>
                  </td>
                  {hasFinance && <td key="rate" className="tutor-base-rate"><button type="button" className="tutor-rate-link" title="Edit tutor compensation" onClick={() => setAccount({ id: tutor.id, tab: 'compensation' })}>
                    {rates[tutor.id] ? usdRateLabel(rates[tutor.id].baseRateCents) : ratesError ? 'Unavailable' : 'Loading...'}<i aria-hidden="true" className="ri-pencil-line" />
                  </button></td>}
                  <td key="languages">
                    <div className="language-tags">
                      {(tutor.languages || []).slice(0, 2).map((lang, i) => (
                        <span key={i} className="language-tag">{lang}</span>
                      ))}
                      {(tutor.languages || []).length > 2 && (
                        <span className="language-tag more">+{tutor.languages.length - 2}</span>
                      )}
                      {!tutor.languages?.length && <span className="not-taken">Not set</span>}
                    </div>
                  </td>
                  <td key="written">
                    {typeof tutor.writtenExamScore === 'number' && Number.isFinite(tutor.writtenExamScore) ? (
                      <span className={`exam-score ${tutor.writtenExamPassed ? 'passed' : 'failed'}`}>
                        {tutor.writtenExamScore}%
                      </span>
                    ) : (
                      <span className="not-taken">Not taken</span>
                    )}
                  </td>
                  <td key="speaking">
                    {typeof tutor.speakingExamScore === 'number' && Number.isFinite(tutor.speakingExamScore) ? (
                      <span className={`exam-score ${tutor.speakingExamPassed ? 'passed' : 'failed'}`}>
                        {tutor.speakingExamScore}%
                      </span>
                    ) : tutor.status === 'processing' ? (
                      <span className="processing-text"><i className="ri-loader-4-line"></i> Processing</span>
                    ) : (
                      <span className="not-taken">Not taken</span>
                    )}
                  </td>
                  <td key="status">{getStatusBadge(tutor)}</td>
                  <td key="bookings" className="tutor-booking-access">
                    <span className={`booking-access-status ${bookingBlocked(tutor) ? 'blocked' : tutor.isSuspended ? 'suspended' : tutor.isBlocked === undefined ? 'unknown' : 'open'}`}>
                      <i aria-hidden="true" className={bookingBlocked(tutor) ? 'ri-lock-line' : tutor.isSuspended ? 'ri-forbid-line' : tutor.isBlocked === undefined ? 'ri-question-line' : 'ri-checkbox-circle-line'} />
                      {bookingBlocked(tutor) ? 'Blocked' : tutor.isSuspended ? 'Suspended' : tutor.isBlocked === undefined ? 'Unavailable' : tutor.penaltyBlockOverrideUntil && Date.parse(tutor.penaltyBlockOverrideUntil) > Date.now() ? 'Block waived' : 'No block'}
                    </span>
                    {bookingBlocked(tutor) && <small>{tutor.blockExpiresAt ? `Until ${dateText(tutor.blockExpiresAt)}` : 'Until lifted'}</small>}
                    {!bookingBlocked(tutor) && tutor.penaltyBlockOverrideUntil && Date.parse(tutor.penaltyBlockOverrideUntil) > Date.now() && <small>Waiver ends {dateText(tutor.penaltyBlockOverrideUntil)}</small>}
                    {bookingBlocked(tutor) && hasOperations && <button type="button" className="booking-unblock" title={`Lift booking block for ${tutor.name || tutor.email}`} onClick={() => setUnblockingTutor(tutor)}>
                      <i aria-hidden="true" className="ri-lock-unlock-line" />Lift block
                    </button>}
                  </td>
                  <td key="proof">{getProofStatusBadge(tutor)}</td>
                  <td key="sessions" className="sessions-cell">{tutor.totalSessions ?? 0}</td>
                  <td key="rating">
                    {tutor.rating > 0 ? (
                      <div className="rating">
                        <i className="ri-star-fill"></i>
                        <span>{tutor.rating.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="no-rating">—</span>
                    )}
                  </td>
                  <td key="actions">
                    <div className="action-buttons">
                      <button type="button" className="action-btn" title="Operations detail" aria-label="Operations detail" onClick={() => setAccount({ id: tutor.id, tab: 'profile' })}><i className="ri-dashboard-line" /></button>
                      <button 
                        className="action-btn view" 
                        title="View Profile"
                        onClick={() => openProfileModal(tutor)}
                      >
                        <i className="ri-eye-line"></i>
                      </button>
                      <button 
                        className="action-btn history" 
                        title="Suspension History"
                        onClick={() => openHistoryModal(tutor)}
                      >
                        <i className="ri-history-line"></i>
                      </button>
                      <button className="action-btn edit" title="Edit" onClick={() => setAccount({ id: tutor.id, tab: 'profile' })}>
                        <i className="ri-edit-line"></i>
                      </button>
                      {canRetryProof(tutor) && (
                        <button
                          className="action-btn proof"
                          title="Retry zkVerify proof submission"
                          onClick={() => handleRetryProof(tutor)}
                          disabled={retryingProofTutorId === tutor.id}
                        >
                          <i className={retryingProofTutorId === tutor.id ? 'ri-loader-4-line spinning' : 'ri-shield-flash-line'}></i>
                        </button>
                      )}
                      {tutor.isSuspended ? (
                        <button 
                          className="action-btn unsuspend" 
                          title="Unsuspend Tutor"
                          onClick={() => handleUnsuspendTutor(tutor)}
                        >
                          <i className="ri-checkbox-circle-line"></i>
                        </button>
                      ) : (
                        <button 
                          className="action-btn suspend" 
                          title="Suspend Tutor"
                          onClick={() => openSuspendModal(tutor)}
                        >
                          <i className="ri-forbid-line"></i>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && tutors.length === 0 && (
          <div className="empty-state">
            <i className="ri-user-search-line"></i>
            <p>No tutors found matching your criteria</p>
          </div>
        )}
      </div>

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
      {showSuspendModal && suspendingTutor && (
        <div className="modal-overlay" onClick={closeSuspendModal}>
          <div className="suspend-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-forbid-line"></i> Suspend Tutor</h3>
              <button className="modal-close" onClick={closeSuspendModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="suspend-tutor-info">
                <ProfileAvatar src={suspendingTutor.profilePicture} name={suspendingTutor.name || suspendingTutor.email} className="tutor-avatar"
                  fallback={<span>{suspendingTutor.name?.charAt(0) || 'T'}</span>} />
                <div className="tutor-details">
                  <span className="tutor-name">{suspendingTutor.name}</span>
                  <span className="tutor-email">{suspendingTutor.email}</span>
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
                onClick={handleSuspendTutor}
                disabled={!suspendReason.trim() || !suspendUntil || suspendLoading}
              >
                {suspendLoading ? (
                  <><i className="ri-loader-4-line spinning"></i> Suspending...</>
                ) : (
                  <><i className="ri-forbid-line"></i> Suspend Tutor</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Profile Modal */}
      {showProfileModal && viewingTutor && (
        <div className="modal-overlay" onClick={closeProfileModal}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><i className="ri-user-line"></i> Tutor Profile</h3>
              <button className="modal-close" onClick={closeProfileModal}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="profile-header">
                <ProfileAvatar src={viewingTutor.profilePicture} name={viewingTutor.name || viewingTutor.email} className={`profile-avatar ${viewingTutor.isSuspended ? 'suspended' : ''}`}
                  fallback={<span>{viewingTutor.name?.charAt(0) || 'T'}</span>} />
                <div className="profile-info">
                  <h2>{viewingTutor.name}</h2>
                  <p>{viewingTutor.email}</p>
                  {viewingTutor.isSuspended && (
                    <span className="profile-suspended-badge">
                      <i className="ri-forbid-line"></i> Suspended until {formatDate(viewingTutor.suspendedUntil!)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Status & Certification</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Status</span>
                    <span className={`value status-${viewingTutor.status}`}>
                      {viewingTutor.status.charAt(0).toUpperCase() + viewingTutor.status.slice(1)}
                    </span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Registered</span>
                    <span className="value">{formatDate(viewingTutor.registeredAt)}</span>
                  </div>
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Exam Results</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Written Exam</span>
                    <span className={`value ${viewingTutor.writtenExamPassed ? 'passed' : 'failed'}`}>
                      {typeof viewingTutor.writtenExamScore === 'number' && Number.isFinite(viewingTutor.writtenExamScore) ? `${viewingTutor.writtenExamScore}%` : 'Not taken'}
                      {viewingTutor.writtenExamPassed && <i className="ri-check-line"></i>}
                    </span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Speaking Exam</span>
                    <span className={`value ${viewingTutor.speakingExamPassed ? 'passed' : 'failed'}`}>
                      {typeof viewingTutor.speakingExamScore === 'number' && Number.isFinite(viewingTutor.speakingExamScore) ? `${viewingTutor.speakingExamScore}%` : 'Not taken'}
                      {viewingTutor.speakingExamPassed && <i className="ri-check-line"></i>}
                    </span>
                  </div>
                </div>
              </div>

              <div className="profile-section">
                <h4>ZK Certification Proof</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Proof Status</span>
                    <span className="value">{getProofStatusBadge(viewingTutor)}</span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Domain</span>
                    <span className="value">{viewingTutor.zkVerifyDomainId || 'Not submitted'}</span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Aggregation ID</span>
                    <span className="value">{viewingTutor.zkVerifyAggregationId ?? 'Not available'}</span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Transaction</span>
                    <span className="value proof-hash">
                      {viewingTutor.zkVerifyTxHash || 'Not submitted'}
                    </span>
                  </div>
                </div>
                {viewingTutor.zkVerifyLastError && (
                  <div className="proof-error">
                    <i className="ri-error-warning-line"></i>
                    {viewingTutor.zkVerifyLastError}
                  </div>
                )}
              </div>
              
              <div className="profile-section">
                <h4>Teaching Stats</h4>
                <div className="profile-grid">
                  <div className="profile-item">
                    <span className="label">Total Sessions</span>
                    <span className="value">{viewingTutor.totalSessions}</span>
                  </div>
                  <div className="profile-item">
                    <span className="label">Rating</span>
                    <span className="value rating">
                      {viewingTutor.rating > 0 ? (
                        <><i className="ri-star-fill"></i> {viewingTutor.rating.toFixed(1)}</>
                      ) : (
                        'No ratings yet'
                      )}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="profile-section">
                <h4>Languages</h4>
                <div className="language-tags">
                  {(viewingTutor.languages || []).map((lang, i) => (
                    <span key={i} className="language-tag">{lang}</span>
                  ))}
                </div>
              </div>
              
              {viewingTutor.isSuspended && (
                <div className="profile-section suspension-section">
                  <h4><i className="ri-error-warning-line"></i> Suspension Details</h4>
                  <div className="suspension-details">
                    <div className="suspension-item">
                      <span className="label">Suspended Until</span>
                      <span className="value">{formatDate(viewingTutor.suspendedUntil!)}</span>
                    </div>
                    <div className="suspension-item">
                      <span className="label">Reason</span>
                      <span className="value reason">{viewingTutor.suspendedReason}</span>
                    </div>
                    {viewingTutor.suspendedAt && (
                      <div className="suspension-item">
                        <span className="label">Suspended On</span>
                        <span className="value">{formatDate(viewingTutor.suspendedAt)}</span>
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
              {viewingTutor.isSuspended ? (
                <button 
                  className="btn-unsuspend" 
                  onClick={() => {
                    handleUnsuspendTutor(viewingTutor);
                    closeProfileModal();
                  }}
                >
                  <i className="ri-checkbox-circle-line"></i> Unsuspend Tutor
                </button>
              ) : (
                <button 
                  className="btn-suspend" 
                  onClick={() => {
                    closeProfileModal();
                    openSuspendModal(viewingTutor);
                  }}
                >
                  <i className="ri-forbid-line"></i> Suspend Tutor
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suspension History Modal */}
      {showHistoryModal && historyTutor && (
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
                  <span>{historyTutor.name?.charAt(0) || 'T'}</span>
                </div>
                <div className="history-details">
                  <span className="history-name">{historyTutor.name}</span>
                  <span className="history-email">{historyTutor.email}</span>
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
                  <p>No suspension history for this tutor</p>
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
      {account && <OperationsAccountModal key={account.id} tutorId={account.id} initialTab={account.tab} onClose={closeAccount} />}
      {unblockingTutor && <OperationsAction action={{ kind: 'unblock', id: unblockingTutor.id, name: unblockingTutor.name || unblockingTutor.email }}
        permissions={hasOperations ? ['operations'] : []} onClose={() => setUnblockingTutor(null)}
        onSaved={async () => { await loadTutors(); setSuccessMessage(`Booking restriction lifted for ${unblockingTutor.name || unblockingTutor.email}.`); }} />}
    </div>
  );
};

export default TutorsPage;
