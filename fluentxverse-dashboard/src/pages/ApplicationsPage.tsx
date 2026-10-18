import { useState, useEffect } from 'preact/hooks';
import { adminApi, PendingTutor, PendingProfileReview, ProfileItemStatuses } from '../api/admin.api';
import './ApplicationsPage.css';

type ProfileItemKey = 'profilePicture' | 'videoIntro' | 'bio' | 'education' | 'interests';
type TabType = 'applications' | 'profiles' | 'changes';

interface PendingChange {
  itemKey: string;
  fieldKey: string;
  newValue: any;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  submittedAt: string;
}

interface TutorWithPendingChanges {
  id: string;
  name: string;
  email: string;
  profilePicture?: string;
  pendingChanges: PendingChange[];
  profileStatus: string;
}

const ApplicationsPage = () => {
  const [activeTab, setActiveTab] = useState<TabType>('applications');
  const [applications, setApplications] = useState<PendingTutor[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfileReview[]>([]);
  const [tutorsWithChanges, setTutorsWithChanges] = useState<TutorWithPendingChanges[]>([]);
  const [certifiedCount, setCertifiedCount] = useState(0);
  const [pendingProfileCount, setPendingProfileCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewingItem, setReviewingItem] = useState<ProfileItemKey | null>(null);
  const [reviewingChange, setReviewingChange] = useState<{ tutorId: string; index: number } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState<PendingProfileReview | null>(null);
  const [showChangesModal, setShowChangesModal] = useState<TutorWithPendingChanges | null>(null);
  const [changeRejectReason, setChangeRejectReason] = useState('');
  const [itemRejectReasons, setItemRejectReasons] = useState<Record<ProfileItemKey, string>>({
    profilePicture: '',
    videoIntro: '',
    bio: '',
    education: '',
    interests: ''
  });

  useEffect(() => {
    loadApplications();
    loadPendingProfiles();
    loadTutorsWithChanges();
    loadStats();
  }, []);

  const loadApplications = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await adminApi.getPendingTutors(50);
      setApplications(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const stats = await adminApi.getStats();
      setCertifiedCount(stats.certifiedTutors);
      setPendingProfileCount(stats.pendingTutors);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadPendingProfiles = async () => {
    try {
      const data = await adminApi.getPendingProfiles(50);
      setPendingProfiles(data);
    } catch (err) {
      console.error('Failed to load pending profiles:', err);
    }
  };

  const loadTutorsWithChanges = async () => {
    try {
      const data = await adminApi.getPendingChanges(50);
      setTutorsWithChanges(data);
    } catch (err) {
      console.error('Failed to load pending changes:', err);
    }
  };

  const handleReviewChange = async (tutorId: string, changeIndex: number, action: 'approve' | 'reject') => {
    if (action === 'reject' && !changeRejectReason.trim()) {
      setError('Please provide a reason for rejecting this change');
      return;
    }

    try {
      setReviewingChange({ tutorId, index: changeIndex });
      setError('');
      const result = await adminApi.reviewPendingChange(
        tutorId,
        changeIndex,
        action,
        action === 'reject' ? changeRejectReason : undefined
      );

      // Update local state
      if (showChangesModal && showChangesModal.id === tutorId) {
        const updatedChanges = showChangesModal.pendingChanges.filter((_, idx) => idx !== changeIndex);
        if (updatedChanges.length === 0) {
          // No more changes, close modal and remove from list
          setShowChangesModal(null);
          setTutorsWithChanges(prev => prev.filter(t => t.id !== tutorId));
        } else {
          setShowChangesModal({ ...showChangesModal, pendingChanges: updatedChanges });
          setTutorsWithChanges(prev => prev.map(t => 
            t.id === tutorId ? { ...t, pendingChanges: updatedChanges } : t
          ));
        }
      }

      setChangeRejectReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to review change');
    } finally {
      setReviewingChange(null);
    }
  };

  const handleReviewItem = async (tutorId: string, itemKey: ProfileItemKey, action: 'approve' | 'reject') => {
    const reason = itemRejectReasons[itemKey];
    if (action === 'reject' && !reason.trim()) {
      setError(`Please provide a reason for rejecting ${getItemLabel(itemKey)}`);
      return;
    }

    try {
      setReviewingItem(itemKey);
      setError('');
      const result = await adminApi.reviewProfileItem(tutorId, itemKey, action, reason);
      
      // Update the modal's profile with new statuses
      if (showProfileModal) {
        setShowProfileModal({
          ...showProfileModal,
          profileItemStatuses: result.profileItemStatuses
        });
        
        // Also update in the list
        setPendingProfiles(prev => prev.map(p => 
          p.id === tutorId 
            ? { ...p, profileItemStatuses: result.profileItemStatuses }
            : p
        ));
      }
      
      // If all approved, remove from pending list
      if (result.allApproved) {
        setPendingProfiles(prev => prev.filter(p => p.id !== tutorId));
        setShowProfileModal(null);
      }
      
      // Clear the reject reason for this item
      setItemRejectReasons(prev => ({ ...prev, [itemKey]: '' }));
    } catch (err: any) {
      setError(err.message || 'Failed to review item');
    } finally {
      setReviewingItem(null);
    }
  };

  const getItemLabel = (key: ProfileItemKey): string => {
    const labels: Record<ProfileItemKey, string> = {
      profilePicture: 'Profile Photo',
      videoIntro: 'Introduction Video',
      bio: 'Bio',
      education: 'Education',
      interests: 'Interests'
    };
    return labels[key];
  };

  const getItemIcon = (key: ProfileItemKey): string => {
    const icons: Record<ProfileItemKey, string> = {
      profilePicture: 'ri-image-line',
      videoIntro: 'ri-video-line',
      bio: 'ri-file-text-line',
      education: 'ri-graduation-cap-line',
      interests: 'ri-heart-line'
    };
    return icons[key];
  };

  const getChangeIcon = (itemKey: string): string => {
    const icons: Record<string, string> = {
      bio: 'ri-file-text-line',
      profilePicture: 'ri-image-line',
      videoIntroUrl: 'ri-video-line',
      schoolAttended: 'ri-graduation-cap-line',
      major: 'ri-book-line',
      interests: 'ri-heart-line'
    };
    return icons[itemKey] || 'ri-edit-line';
  };

  const getChangeLabel = (itemKey: string): string => {
    const labels: Record<string, string> = {
      bio: 'Bio',
      profilePicture: 'Profile Photo',
      videoIntroUrl: 'Introduction Video',
      schoolAttended: 'School/University',
      major: 'Major/Field of Study',
      interests: 'Interests'
    };
    return labels[itemKey] || itemKey;
  };

  const renderChangeValue = (change: PendingChange) => {
    if (change.itemKey === 'profilePicture' && change.newValue) {
      return (
        <a href={change.newValue} target="_blank" rel="noopener noreferrer">
          <img src={change.newValue} alt="New profile photo" className="change-image-preview" />
        </a>
      );
    }
    if (change.itemKey === 'videoIntroUrl' && change.newValue) {
      return (
        <video src={change.newValue} controls className="change-video-preview" />
      );
    }
    if (change.itemKey === 'interests') {
      // Handle both array and JSON string formats
      let interests: string[] = [];
      if (Array.isArray(change.newValue)) {
        interests = change.newValue;
      } else if (typeof change.newValue === 'string') {
        try {
          const parsed = JSON.parse(change.newValue);
          if (Array.isArray(parsed)) {
            interests = parsed;
          }
        } catch {
          // Not valid JSON, treat as single interest
          interests = [change.newValue];
        }
      }
      
      if (interests.length > 0) {
        return (
          <div className="interests-chips">
            {interests.map((interest: string, idx: number) => (
              <span key={idx} className="interest-chip">{interest}</span>
            ))}
          </div>
        );
      }
    }
    return <p>{String(change.newValue)}</p>;
  };

  const getApprovalProgress = (statuses?: ProfileItemStatuses): { approved: number; total: number; percent: number } => {
    if (!statuses) return { approved: 0, total: 5, percent: 0 };
    const items = Object.values(statuses);
    const approved = items.filter(s => s.status === 'approved').length;
    return { approved, total: 5, percent: Math.round((approved / 5) * 100) };
  };

  const getStatusInfo = (app: PendingTutor) => {
    // Check interview result first
    if (app.interviewResult === 'pass') {
      return { label: 'Interview Passed', class: 'interview-pass', icon: 'ri-check-double-line' };
    }
    if (app.interviewResult === 'fail') {
      return { label: 'Interview Failed', class: 'interview-fail', icon: 'ri-close-circle-line' };
    }
    if (app.status === 'processing') {
      return { label: 'Interview Processing', class: 'processing', icon: 'ri-loader-4-line' };
    }
    if (!app.writtenExamPassed) {
      return { label: 'Pending Written Exam', class: 'pending-written', icon: 'ri-file-text-line' };
    }
    if (!app.speakingExamPassed) {
      return { label: 'Pending Speaking Exam', class: 'pending-speaking', icon: 'ri-mic-line' };
    }
    return { label: 'Under Review', class: 'review', icon: 'ri-search-line' };
  };

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true;
    if (filter === 'pending_written') return !app.writtenExamPassed;
    if (filter === 'pending_speaking') return app.writtenExamPassed && !app.speakingExamPassed;
    if (filter === 'processing') return app.status === 'processing';
    if (filter === 'interview_passed') return app.interviewResult === 'pass';
    if (filter === 'interview_failed') return app.interviewResult === 'fail';
    return true;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const stats = {
    total: applications.length,
    pendingWritten: applications.filter(a => !a.writtenExamPassed).length,
    pendingSpeaking: applications.filter(a => a.writtenExamPassed && !a.speakingExamPassed).length,
    processing: applications.filter(a => a.status === 'processing').length,
    interviewPassed: applications.filter(a => a.interviewResult === 'pass').length,
    interviewFailed: applications.filter(a => a.interviewResult === 'fail').length,
  };

  return (
    <div className="applications-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Tutor Applications</h1>
          <p>Review and process tutor applications and profile submissions</p>
        </div>
        <div className="page-tabs">
          <button 
            className={`tab-btn ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            <i className="ri-file-user-line"></i>
            Exam Applications
            <span className="tab-badge">{applications.length}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
            onClick={() => setActiveTab('profiles')}
          >
            <i className="ri-user-settings-line"></i>
            Profile Reviews
            <span className="tab-badge">{pendingProfiles.length}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'changes' ? 'active' : ''}`}
            onClick={() => setActiveTab('changes')}
          >
            <i className="ri-edit-line"></i>
            Pending Changes
            {tutorsWithChanges.length > 0 && (
              <span className="tab-badge highlight">{tutorsWithChanges.reduce((acc, t) => acc + t.pendingChanges.length, 0)}</span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'applications' && (
        <>
          {/* Stats Cards */}
          <div className="stats-grid">
        <div className={`stat-card ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          <div className="stat-icon total">
            <i className="ri-file-user-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Applications</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'pending_written' ? 'active' : ''}`} onClick={() => setFilter('pending_written')}>
          <div className="stat-icon pending-written">
            <i className="ri-file-text-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.pendingWritten}</span>
            <span className="stat-label">Pending Written</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'pending_speaking' ? 'active' : ''}`} onClick={() => setFilter('pending_speaking')}>
          <div className="stat-icon pending-speaking">
            <i className="ri-mic-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.pendingSpeaking}</span>
            <span className="stat-label">Pending Speaking</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'processing' ? 'active' : ''}`} onClick={() => setFilter('processing')}>
          <div className="stat-icon processing">
            <i className="ri-loader-4-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.processing}</span>
            <span className="stat-label">Processing</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'interview_passed' ? 'active' : ''}`} onClick={() => setFilter('interview_passed')}>
          <div className="stat-icon interview-pass">
            <i className="ri-check-double-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.interviewPassed}</span>
            <span className="stat-label">Interview Passed</span>
          </div>
        </div>
        <div className={`stat-card ${filter === 'interview_failed' ? 'active' : ''}`} onClick={() => setFilter('interview_failed')}>
          <div className="stat-icon interview-fail">
            <i className="ri-close-circle-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{stats.interviewFailed}</span>
            <span className="stat-label">Interview Failed</span>
          </div>
        </div>
        <div className="stat-card info-card">
          <div className="stat-icon pending-profile">
            <i className="ri-user-settings-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{pendingProfileCount}</span>
            <span className="stat-label">Pending Profile</span>
          </div>
        </div>
        <div className="stat-card info-card">
          <div className="stat-icon certified">
            <i className="ri-verified-badge-line"></i>
          </div>
          <div className="stat-content">
            <span className="stat-number">{certifiedCount}</span>
            <span className="stat-label">Certified</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          <i className="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      {/* Applications List */}
      <div className="applications-container">
        <div className="container-header">
          <h2>Applications ({filteredApplications.length})</h2>
          <button className="btn-refresh" onClick={loadApplications}>
            <i className="ri-refresh-line"></i>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading-state">
            <i className="ri-loader-4-line spinning"></i>
            <span>Loading applications...</span>
          </div>
        ) : (
          <div className="applications-list">
            {filteredApplications.map(app => {
              const statusInfo = getStatusInfo(app);
              return (
                <div className="application-card" key={app.id}>
                  <div className="card-main">
                    <div className="applicant-info">
                      <div className="applicant-avatar">
                        {app.name?.charAt(0) || 'T'}
                      </div>
                      <div className="applicant-details">
                        <h3 className="applicant-name">{app.name}</h3>
                        <p className="applicant-email">{app.email}</p>
                        <span className="applied-date">
                          <i className="ri-calendar-line"></i>
                          Applied {formatDate(app.registeredAt)}
                        </span>
                      </div>
                    </div>

                    <div className="exam-progress">
                      <div className={`exam-step ${app.writtenExamPassed ? 'completed' : 'pending'}`}>
                        <div className="step-icon">
                          <i className={app.writtenExamPassed ? 'ri-check-line' : 'ri-file-text-line'}></i>
                        </div>
                        <span className="step-label">Written</span>
                      </div>
                      <div className="step-connector"></div>
                      <div className={`exam-step ${app.speakingExamPassed ? 'completed' : app.writtenExamPassed ? 'current' : 'pending'}`}>
                        <div className="step-icon">
                          <i className={app.speakingExamPassed ? 'ri-check-line' : 'ri-mic-line'}></i>
                        </div>
                        <span className="step-label">Speaking</span>
                      </div>
                      <div className="step-connector"></div>
                      <div className={`exam-step ${app.writtenExamPassed && app.speakingExamPassed ? 'completed' : 'pending'}`}>
                        <div className="step-icon">
                          <i className="ri-shield-check-line"></i>
                        </div>
                        <span className="step-label">Certified</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-footer">
                    <span className={`status-badge ${statusInfo.class}`}>
                      <i className={statusInfo.icon}></i>
                      {statusInfo.label}
                    </span>
                    <div className="card-actions">
                      <button className="btn-action view">
                        <i className="ri-eye-line"></i>
                        View
                      </button>
                      {app.writtenExamPassed && !app.speakingExamPassed && app.status !== 'processing' && (
                        <a href="/interviews" className="btn-action schedule">
                          <i className="ri-calendar-schedule-line"></i>
                          Schedule Interview
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && filteredApplications.length === 0 && (
          <div className="empty-state">
            <i className="ri-file-search-line"></i>
            <p>No applications found</p>
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === 'profiles' && (
        <div className="profiles-container">
          <div className="container-header">
            <h2>Profile Reviews ({pendingProfiles.length})</h2>
            <button className="btn-refresh" onClick={loadPendingProfiles}>
              <i className="ri-refresh-line"></i>
              Refresh
            </button>
          </div>

          {pendingProfiles.length === 0 ? (
            <div className="empty-state">
              <i className="ri-user-settings-line"></i>
              <p>No pending profile reviews</p>
              <span className="empty-hint">Tutors who complete their profile will appear here for review</span>
            </div>
          ) : (
            <div className="profiles-grid">
              {pendingProfiles.map(profile => (
                <div 
                  key={profile.id} 
                  className="profile-review-card clickable"
                  onClick={() => {
                    setShowProfileModal(profile);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="profile-card-header">
                    <div className="profile-avatar-wrapper">
                      {profile.profilePicture ? (
                        <img src={profile.profilePicture} alt={profile.name} className="profile-avatar" />
                      ) : (
                        <div className="profile-avatar placeholder">
                          {profile.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="profile-info">
                      <h3 className="profile-name">{profile.name}</h3>
                      <p className="profile-email">{profile.email}</p>
                    </div>
                    <div className="profile-submitted-badge">
                      <i className="ri-time-line"></i>
                      <span>{formatDate(profile.submittedAt)}</span>
                    </div>
                  </div>

                  <div className="profile-preview">
                    {profile.bio && (
                      <p className="preview-bio">
                        {profile.bio.length > 80 ? `${profile.bio.substring(0, 80)}...` : profile.bio}
                      </p>
                    )}
                    <div className="preview-badges">
                      {profile.profilePicture && (
                        <span className="preview-badge has"><i className="ri-image-line"></i> Photo</span>
                      )}
                      {profile.videoIntroUrl && (
                        <span className="preview-badge has"><i className="ri-video-line"></i> Video</span>
                      )}
                      {profile.schoolAttended && (
                        <span className="preview-badge has"><i className="ri-graduation-cap-line"></i> Education</span>
                      )}
                      {(profile.interests?.length ?? 0) > 0 && (
                        <span className="preview-badge has"><i className="ri-heart-line"></i> Interests</span>
                      )}
                    </div>
                  </div>

                  <div className="click-hint">
                    <span>Click to review</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'changes' && (
        <div className="changes-container">
          <div className="container-header">
            <h2>Pending Profile Changes ({tutorsWithChanges.reduce((acc, t) => acc + t.pendingChanges.length, 0)})</h2>
            <button className="btn-refresh" onClick={loadTutorsWithChanges}>
              <i className="ri-refresh-line"></i>
              Refresh
            </button>
          </div>

          {tutorsWithChanges.length === 0 ? (
            <div className="empty-state">
              <i className="ri-edit-line"></i>
              <p>No pending profile changes</p>
              <span className="empty-hint">Approved tutors who edit their profiles will appear here for change review</span>
            </div>
          ) : (
            <div className="profiles-grid">
              {tutorsWithChanges.map(tutor => (
                <div 
                  key={tutor.id} 
                  className="profile-review-card clickable changes-card"
                  onClick={() => setShowChangesModal(tutor)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="profile-card-header">
                    <div className="profile-avatar-wrapper">
                      {tutor.profilePicture ? (
                        <img src={tutor.profilePicture} alt={tutor.name} className="profile-avatar" />
                      ) : (
                        <div className="profile-avatar placeholder">
                          {tutor.name.charAt(0)}
                        </div>
                      )}
                      <span className="verified-badge" title="Approved Tutor">
                        <i className="ri-verified-badge-fill"></i>
                      </span>
                    </div>
                    <div className="profile-info">
                      <h3 className="profile-name">{tutor.name}</h3>
                      <p className="profile-email">{tutor.email}</p>
                    </div>
                    <div className="changes-count-badge">
                      <span>{tutor.pendingChanges.length}</span>
                      <span className="changes-label">pending</span>
                    </div>
                  </div>

                  <div className="pending-changes-preview">
                    <h4>Changes awaiting review:</h4>
                    <ul className="changes-list">
                      {tutor.pendingChanges.slice(0, 3).map((change, idx) => (
                        <li key={idx} className="change-item-preview">
                          <i className={getChangeIcon(change.itemKey)}></i>
                          <span>{getChangeLabel(change.itemKey)}</span>
                        </li>
                      ))}
                      {tutor.pendingChanges.length > 3 && (
                        <li className="more-changes">+{tutor.pendingChanges.length - 3} more</li>
                      )}
                    </ul>
                  </div>

                  <div className="click-hint">
                    <span>Click to review changes</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending Changes Review Modal */}
      {showChangesModal && (
        <div className="modal-overlay" onClick={() => { setShowChangesModal(null); setChangeRejectReason(''); setError(''); }}>
          <div className="profile-modal changes-review-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Profile Changes</h2>
              <div className="changes-count">
                <span>{showChangesModal.pendingChanges.length} change{showChangesModal.pendingChanges.length !== 1 ? 's' : ''} pending</span>
              </div>
              <button className="modal-close" onClick={() => { setShowChangesModal(null); setChangeRejectReason(''); setError(''); }}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              {error && (
                <div className="modal-error">
                  <i className="ri-error-warning-line"></i>
                  {error}
                </div>
              )}
              
              <div className="modal-profile-header">
                {showChangesModal.profilePicture ? (
                  <img src={showChangesModal.profilePicture} alt={showChangesModal.name} className="modal-avatar" />
                ) : (
                  <div className="modal-avatar placeholder">{showChangesModal.name.charAt(0)}</div>
                )}
                <div className="modal-profile-info">
                  <h3>{showChangesModal.name}</h3>
                  <p>{showChangesModal.email}</p>
                  <span className="approved-status">
                    <i className="ri-verified-badge-fill"></i>
                    Approved Tutor
                  </span>
                </div>
              </div>

              <div className="changes-info-banner">
                <i className="ri-information-line"></i>
                <p>This tutor has already been approved. These are edits they've made to their profile that need review before going live.</p>
              </div>

              {showChangesModal.pendingChanges.map((change, idx) => (
                <div key={idx} className={`review-item-card pending`}>
                  <div className="item-header">
                    <div className="item-title">
                      <i className={getChangeIcon(change.itemKey)}></i>
                      <h4>{getChangeLabel(change.itemKey)}</h4>
                    </div>
                    <div className="item-status pending">
                      <i className="ri-time-line"></i> Pending Review
                    </div>
                  </div>
                  <div className="item-content change-preview">
                    <span className="change-label">New Value:</span>
                    {renderChangeValue(change)}
                  </div>
                  <div className="change-submitted">
                    <i className="ri-calendar-line"></i>
                    Submitted {formatDate(change.submittedAt)}
                  </div>
                  <div className="item-actions">
                    <input 
                      type="text" 
                      placeholder="Rejection reason (required if rejecting)"
                      value={changeRejectReason}
                      onChange={e => setChangeRejectReason((e.target as HTMLInputElement).value)}
                      className="reject-input"
                    />
                    <div className="action-buttons">
                      <button 
                        className="btn-item-reject"
                        onClick={() => handleReviewChange(showChangesModal.id, idx, 'reject')}
                        disabled={reviewingChange?.tutorId === showChangesModal.id && reviewingChange?.index === idx}
                      >
                        <i className="ri-close-line"></i> Reject
                      </button>
                      <button 
                        className="btn-item-approve"
                        onClick={() => handleReviewChange(showChangesModal.id, idx, 'approve')}
                        disabled={reviewingChange?.tutorId === showChangesModal.id && reviewingChange?.index === idx}
                      >
                        {reviewingChange?.tutorId === showChangesModal.id && reviewingChange?.index === idx 
                          ? <i className="ri-loader-4-line spinning"></i> 
                          : <i className="ri-check-line"></i>
                        } Approve Change
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Profile Review Modal */}
      {showProfileModal && (
        <div className="modal-overlay" onClick={() => { setShowProfileModal(null); setItemRejectReasons({ profilePicture: '', videoIntro: '', bio: '', education: '', interests: '' }); setError(''); }}>
          <div className="profile-modal granular-review" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Profile</h2>
              <div className="approval-progress">
                <span className="progress-text">
                  {getApprovalProgress(showProfileModal.profileItemStatuses).approved}/5 approved
                </span>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${getApprovalProgress(showProfileModal.profileItemStatuses).percent}%` }}
                  />
                </div>
              </div>
              <button className="modal-close" onClick={() => { setShowProfileModal(null); setItemRejectReasons({ profilePicture: '', videoIntro: '', bio: '', education: '', interests: '' }); setError(''); }}>
                <i className="ri-close-line"></i>
              </button>
            </div>
            <div className="modal-body">
              {error && (
                <div className="modal-error">
                  <i className="ri-error-warning-line"></i>
                  {error}
                </div>
              )}
              
              <div className="modal-profile-header">
                {showProfileModal.profilePicture ? (
                  <a href={showProfileModal.profilePicture} target="_blank" rel="noopener noreferrer" className="avatar-link">
                    <img src={showProfileModal.profilePicture} alt={showProfileModal.name} className="modal-avatar" />
                    <span className="avatar-zoom"><i className="ri-zoom-in-line"></i></span>
                  </a>
                ) : (
                  <div className="modal-avatar placeholder">{showProfileModal.name.charAt(0)}</div>
                )}
                <div className="modal-profile-info">
                  <h3>{showProfileModal.name}</h3>
                  <p>{showProfileModal.email}</p>
                  <span className="submitted-date">
                    <i className="ri-time-line"></i>
                    Submitted {formatDate(showProfileModal.submittedAt)}
                  </span>
                </div>
              </div>

              {/* Profile Picture Review */}
              <div className={`review-item-card ${showProfileModal.profileItemStatuses?.profilePicture?.status || 'pending'}`}>
                <div className="item-header">
                  <div className="item-title">
                    <i className="ri-image-line"></i>
                    <h4>Profile Photo</h4>
                  </div>
                  <div className={`item-status ${showProfileModal.profileItemStatuses?.profilePicture?.status || 'pending'}`}>
                    {showProfileModal.profileItemStatuses?.profilePicture?.status === 'approved' && <><i className="ri-check-line"></i> Approved</>}
                    {showProfileModal.profileItemStatuses?.profilePicture?.status === 'rejected' && <><i className="ri-close-line"></i> Rejected</>}
                    {(!showProfileModal.profileItemStatuses?.profilePicture?.status || showProfileModal.profileItemStatuses?.profilePicture?.status === 'pending') && <><i className="ri-time-line"></i> Pending</>}
                  </div>
                </div>
                <div className="item-content">
                  {showProfileModal.profilePicture ? (
                    <a href={showProfileModal.profilePicture} target="_blank" rel="noopener noreferrer">
                      <img src={showProfileModal.profilePicture} alt="Profile" className="review-image" />
                    </a>
                  ) : (
                    <p className="missing">No profile photo uploaded</p>
                  )}
                </div>
                {showProfileModal.profileItemStatuses?.profilePicture?.status !== 'approved' && showProfileModal.profilePicture && (
                  <div className="item-actions">
                    <input 
                      type="text" 
                      placeholder="Rejection reason (required if rejecting)"
                      value={itemRejectReasons.profilePicture}
                      onChange={e => setItemRejectReasons(prev => ({ ...prev, profilePicture: (e.target as HTMLInputElement).value }))}
                      className="reject-input"
                    />
                    <div className="action-buttons">
                      <button 
                        className="btn-item-reject"
                        onClick={() => handleReviewItem(showProfileModal.id, 'profilePicture', 'reject')}
                        disabled={reviewingItem === 'profilePicture'}
                      >
                        <i className="ri-close-line"></i> Reject
                      </button>
                      <button 
                        className="btn-item-approve"
                        onClick={() => handleReviewItem(showProfileModal.id, 'profilePicture', 'approve')}
                        disabled={reviewingItem === 'profilePicture'}
                      >
                        {reviewingItem === 'profilePicture' ? <i className="ri-loader-4-line spinning"></i> : <i className="ri-check-line"></i>} Approve
                      </button>
                    </div>
                  </div>
                )}
                {showProfileModal.profileItemStatuses?.profilePicture?.rejectionReason && (
                  <div className="rejection-reason">
                    <i className="ri-information-line"></i>
                    {showProfileModal.profileItemStatuses.profilePicture.rejectionReason}
                  </div>
                )}
              </div>

              {/* Bio Review */}
              <div className={`review-item-card ${showProfileModal.profileItemStatuses?.bio?.status || 'pending'}`}>
                <div className="item-header">
                  <div className="item-title">
                    <i className="ri-file-text-line"></i>
                    <h4>Bio</h4>
                  </div>
                  <div className={`item-status ${showProfileModal.profileItemStatuses?.bio?.status || 'pending'}`}>
                    {showProfileModal.profileItemStatuses?.bio?.status === 'approved' && <><i className="ri-check-line"></i> Approved</>}
                    {showProfileModal.profileItemStatuses?.bio?.status === 'rejected' && <><i className="ri-close-line"></i> Rejected</>}
                    {(!showProfileModal.profileItemStatuses?.bio?.status || showProfileModal.profileItemStatuses?.bio?.status === 'pending') && <><i className="ri-time-line"></i> Pending</>}
                  </div>
                </div>
                <div className="item-content">
                  <p className={showProfileModal.bio ? '' : 'missing'}>{showProfileModal.bio || 'Not provided'}</p>
                </div>
                {showProfileModal.profileItemStatuses?.bio?.status !== 'approved' && showProfileModal.bio && (
                  <div className="item-actions">
                    <input 
                      type="text" 
                      placeholder="Rejection reason (required if rejecting)"
                      value={itemRejectReasons.bio}
                      onChange={e => setItemRejectReasons(prev => ({ ...prev, bio: (e.target as HTMLInputElement).value }))}
                      className="reject-input"
                    />
                    <div className="action-buttons">
                      <button 
                        className="btn-item-reject"
                        onClick={() => handleReviewItem(showProfileModal.id, 'bio', 'reject')}
                        disabled={reviewingItem === 'bio'}
                      >
                        <i className="ri-close-line"></i> Reject
                      </button>
                      <button 
                        className="btn-item-approve"
                        onClick={() => handleReviewItem(showProfileModal.id, 'bio', 'approve')}
                        disabled={reviewingItem === 'bio'}
                      >
                        {reviewingItem === 'bio' ? <i className="ri-loader-4-line spinning"></i> : <i className="ri-check-line"></i>} Approve
                      </button>
                    </div>
                  </div>
                )}
                {showProfileModal.profileItemStatuses?.bio?.rejectionReason && (
                  <div className="rejection-reason">
                    <i className="ri-information-line"></i>
                    {showProfileModal.profileItemStatuses.bio.rejectionReason}
                  </div>
                )}
              </div>

              {/* Education Review */}
              <div className={`review-item-card ${showProfileModal.profileItemStatuses?.education?.status || 'pending'}`}>
                <div className="item-header">
                  <div className="item-title">
                    <i className="ri-graduation-cap-line"></i>
                    <h4>Education</h4>
                  </div>
                  <div className={`item-status ${showProfileModal.profileItemStatuses?.education?.status || 'pending'}`}>
                    {showProfileModal.profileItemStatuses?.education?.status === 'approved' && <><i className="ri-check-line"></i> Approved</>}
                    {showProfileModal.profileItemStatuses?.education?.status === 'rejected' && <><i className="ri-close-line"></i> Rejected</>}
                    {(!showProfileModal.profileItemStatuses?.education?.status || showProfileModal.profileItemStatuses?.education?.status === 'pending') && <><i className="ri-time-line"></i> Pending</>}
                  </div>
                </div>
                <div className="item-content">
                  <p className={showProfileModal.schoolAttended ? '' : 'missing'}>
                    {showProfileModal.schoolAttended 
                      ? `${showProfileModal.schoolAttended}${showProfileModal.major ? ` - ${showProfileModal.major}` : ''}`
                      : 'Not provided'}
                  </p>
                </div>
                {showProfileModal.profileItemStatuses?.education?.status !== 'approved' && showProfileModal.schoolAttended && (
                  <div className="item-actions">
                    <input 
                      type="text" 
                      placeholder="Rejection reason (required if rejecting)"
                      value={itemRejectReasons.education}
                      onChange={e => setItemRejectReasons(prev => ({ ...prev, education: (e.target as HTMLInputElement).value }))}
                      className="reject-input"
                    />
                    <div className="action-buttons">
                      <button 
                        className="btn-item-reject"
                        onClick={() => handleReviewItem(showProfileModal.id, 'education', 'reject')}
                        disabled={reviewingItem === 'education'}
                      >
                        <i className="ri-close-line"></i> Reject
                      </button>
                      <button 
                        className="btn-item-approve"
                        onClick={() => handleReviewItem(showProfileModal.id, 'education', 'approve')}
                        disabled={reviewingItem === 'education'}
                      >
                        {reviewingItem === 'education' ? <i className="ri-loader-4-line spinning"></i> : <i className="ri-check-line"></i>} Approve
                      </button>
                    </div>
                  </div>
                )}
                {showProfileModal.profileItemStatuses?.education?.rejectionReason && (
                  <div className="rejection-reason">
                    <i className="ri-information-line"></i>
                    {showProfileModal.profileItemStatuses.education.rejectionReason}
                  </div>
                )}
              </div>

              {/* Interests Review */}
              <div className={`review-item-card ${showProfileModal.profileItemStatuses?.interests?.status || 'pending'}`}>
                <div className="item-header">
                  <div className="item-title">
                    <i className="ri-heart-line"></i>
                    <h4>Interests</h4>
                  </div>
                  <div className={`item-status ${showProfileModal.profileItemStatuses?.interests?.status || 'pending'}`}>
                    {showProfileModal.profileItemStatuses?.interests?.status === 'approved' && <><i className="ri-check-line"></i> Approved</>}
                    {showProfileModal.profileItemStatuses?.interests?.status === 'rejected' && <><i className="ri-close-line"></i> Rejected</>}
                    {(!showProfileModal.profileItemStatuses?.interests?.status || showProfileModal.profileItemStatuses?.interests?.status === 'pending') && <><i className="ri-time-line"></i> Pending</>}
                  </div>
                </div>
                <div className="item-content">
                  {showProfileModal.interests?.length ? (
                    <div className="interests-chips">
                      {showProfileModal.interests.map((interest, idx) => (
                        <span key={idx} className="interest-chip">{interest}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="missing">Not provided</p>
                  )}
                </div>
                {showProfileModal.profileItemStatuses?.interests?.status !== 'approved' && (showProfileModal.interests?.length ?? 0) > 0 && (
                  <div className="item-actions">
                    <input 
                      type="text" 
                      placeholder="Rejection reason (required if rejecting)"
                      value={itemRejectReasons.interests}
                      onChange={e => setItemRejectReasons(prev => ({ ...prev, interests: (e.target as HTMLInputElement).value }))}
                      className="reject-input"
                    />
                    <div className="action-buttons">
                      <button 
                        className="btn-item-reject"
                        onClick={() => handleReviewItem(showProfileModal.id, 'interests', 'reject')}
                        disabled={reviewingItem === 'interests'}
                      >
                        <i className="ri-close-line"></i> Reject
                      </button>
                      <button 
                        className="btn-item-approve"
                        onClick={() => handleReviewItem(showProfileModal.id, 'interests', 'approve')}
                        disabled={reviewingItem === 'interests'}
                      >
                        {reviewingItem === 'interests' ? <i className="ri-loader-4-line spinning"></i> : <i className="ri-check-line"></i>} Approve
                      </button>
                    </div>
                  </div>
                )}
                {showProfileModal.profileItemStatuses?.interests?.rejectionReason && (
                  <div className="rejection-reason">
                    <i className="ri-information-line"></i>
                    {showProfileModal.profileItemStatuses.interests.rejectionReason}
                  </div>
                )}
              </div>

              {/* Video Intro Review */}
              <div className={`review-item-card ${showProfileModal.profileItemStatuses?.videoIntro?.status || 'pending'}`}>
                <div className="item-header">
                  <div className="item-title">
                    <i className="ri-video-line"></i>
                    <h4>Introduction Video</h4>
                  </div>
                  <div className={`item-status ${showProfileModal.profileItemStatuses?.videoIntro?.status || 'pending'}`}>
                    {showProfileModal.profileItemStatuses?.videoIntro?.status === 'approved' && <><i className="ri-check-line"></i> Approved</>}
                    {showProfileModal.profileItemStatuses?.videoIntro?.status === 'rejected' && <><i className="ri-close-line"></i> Rejected</>}
                    {(!showProfileModal.profileItemStatuses?.videoIntro?.status || showProfileModal.profileItemStatuses?.videoIntro?.status === 'pending') && <><i className="ri-time-line"></i> Pending</>}
                  </div>
                </div>
                <div className="item-content">
                  {showProfileModal.videoIntroUrl ? (
                    <video src={showProfileModal.videoIntroUrl} controls className="modal-video" />
                  ) : (
                    <p className="missing">Not uploaded</p>
                  )}
                </div>
                {showProfileModal.profileItemStatuses?.videoIntro?.status !== 'approved' && showProfileModal.videoIntroUrl && (
                  <div className="item-actions">
                    <input 
                      type="text" 
                      placeholder="Rejection reason (required if rejecting)"
                      value={itemRejectReasons.videoIntro}
                      onChange={e => setItemRejectReasons(prev => ({ ...prev, videoIntro: (e.target as HTMLInputElement).value }))}
                      className="reject-input"
                    />
                    <div className="action-buttons">
                      <button 
                        className="btn-item-reject"
                        onClick={() => handleReviewItem(showProfileModal.id, 'videoIntro', 'reject')}
                        disabled={reviewingItem === 'videoIntro'}
                      >
                        <i className="ri-close-line"></i> Reject
                      </button>
                      <button 
                        className="btn-item-approve"
                        onClick={() => handleReviewItem(showProfileModal.id, 'videoIntro', 'approve')}
                        disabled={reviewingItem === 'videoIntro'}
                      >
                        {reviewingItem === 'videoIntro' ? <i className="ri-loader-4-line spinning"></i> : <i className="ri-check-line"></i>} Approve
                      </button>
                    </div>
                  </div>
                )}
                {showProfileModal.profileItemStatuses?.videoIntro?.rejectionReason && (
                  <div className="rejection-reason">
                    <i className="ri-information-line"></i>
                    {showProfileModal.profileItemStatuses.videoIntro.rejectionReason}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationsPage;
