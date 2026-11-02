import { useState, useEffect, useRef } from 'preact/hooks';
import { adminApi, type TutorApplication, type ApplicationCounts, type ApplicationFilter, PendingProfileReview, ProfileItemStatuses } from '../api/admin.api';
import './ApplicationsPage.css';
import ProfileAvatar from '../components/ProfileAvatar';
import { mediaUrl } from '../utils/mediaUrl';
import { API_BASE_URL } from '../config/api';
import { profileApplicationStatus } from '../../../shared/profileApplicationStatus';

const reviewMedia = (src?: string) => mediaUrl(src, API_BASE_URL);
const reviewVideoUrl = (src: string) => {
  const source = reviewMedia(src);
  if (!source) return source;
  try {
    const url = new URL(source);
    if (url.origin === new URL(API_BASE_URL).origin && /^\/lesson\/files\/user\/[^/]+\/video\/[^/]+$/.test(url.pathname)) url.pathname += '/stream';
    return url.toString();
  } catch { return source; }
};
function ReviewVideo({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="review-video-preview">
    <video key={src} src={reviewVideoUrl(src)} controls preload="metadata" aria-label="Submitted introduction video" onLoadedMetadata={() => setFailed(false)} onError={() => setFailed(true)}/>
    {failed && <p className="missing" role="alert">The submitted video could not be loaded.</p>}
  </div>;
}
function ReviewPhoto({ src }: { src: string }) {
  const source = reviewMedia(src);
  const [failed, setFailed] = useState<string>();
  return source && failed !== source ? <a className="profile-review-photo" href={source} target="_blank" rel="noopener noreferrer" aria-label="Open profile photo">
    <img src={source} alt="Profile photo" className="review-image" onError={() => setFailed(source)}/>
  </a> : <p className="missing" role="status">Profile photo could not be loaded.</p>;
}

type ProfileItemKey = 'nickname' | 'profilePicture' | 'videoIntro' | 'bio' | 'education' | 'interests';
type TabType = 'applications' | 'profiles' | 'changes';

interface PendingChange {
  itemKey: string;
  fieldKey: string;
  newValue: any;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  submittedAt: string;
}

const changeField = (change: PendingChange) => {
  const field = change.fieldKey || change.itemKey;
  return field === 'videoIntro' ? 'videoIntroUrl' : field;
};

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
  const [applications, setApplications] = useState<TutorApplication[]>([]);
  const [pendingProfiles, setPendingProfiles] = useState<PendingProfileReview[]>([]);
  const [tutorsWithChanges, setTutorsWithChanges] = useState<TutorWithPendingChanges[]>([]);
  const [stats, setStats] = useState<ApplicationCounts | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [totalApplications, setTotalApplications] = useState(0);
  const applicationRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<ApplicationFilter>('all');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewingItem, setReviewingItem] = useState<ProfileItemKey | null>(null);
  const [reviewingChange, setReviewingChange] = useState<{ tutorId: string; index: number } | null>(null);
  const [showProfileModal, setShowProfileModal] = useState<PendingProfileReview | null>(null);
  const profileDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = profileDialog.current;
    if (!showProfileModal || !dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showProfileModal?.id]);
  const [showChangesModal, setShowChangesModal] = useState<TutorWithPendingChanges | null>(null);
  const [changeRejectReason, setChangeRejectReason] = useState('');
  const [itemRejectReasons, setItemRejectReasons] = useState<Record<ProfileItemKey, string>>({
    nickname: '',
    profilePicture: '',
    videoIntro: '',
    bio: '',
    education: '',
    interests: ''
  });

  useEffect(() => {
    loadPendingProfiles();
    loadTutorsWithChanges();
  }, []);

  useEffect(() => {
    void loadApplications();
    const refresh = () => { if (!document.hidden) void loadApplications(true); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { applicationRequest.current++; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [page, filter]);

  const loadApplications = async (background = false) => {
    const request = ++applicationRequest.current;
    try {
      if (!background) setLoading(true);
      setError('');
      const data = await adminApi.getApplications(filter, page);
      if (request !== applicationRequest.current) return;
      setApplications(data.items);
      setStats(data.counts);
      setPageCount(data.pageCount);
      setTotalApplications(data.total);
      if (data.page !== page) setPage(data.page);
    } catch (err: any) {
      if (request === applicationRequest.current) setError(err.response?.data?.error || err.message || 'Failed to load applications');
    } finally {
      if (request === applicationRequest.current) setLoading(false);
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
      void loadApplications(true);
    } catch (err: any) {
      setError(err.message || 'Failed to review item');
    } finally {
      setReviewingItem(null);
    }
  };

  const getItemLabel = (key: ProfileItemKey): string => {
    const labels: Record<ProfileItemKey, string> = {
      nickname: 'Preferred nickname',
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
      nickname: 'ri-user-line',
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
      nickname: 'ri-user-line',
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
      nickname: 'Preferred nickname',
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
    const field = changeField(change);
    if (field === 'profilePicture' && change.newValue) {
      return (
        <ReviewPhoto src={change.newValue}/>
      );
    }
    if (field === 'videoIntroUrl' && typeof change.newValue === 'string' && change.newValue) {
      return (
        <ReviewVideo src={change.newValue}/>
      );
    }
    if (field === 'interests') {
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
    if (!statuses) return { approved: 0, total: 6, percent: 0 };
    const items = Object.values(statuses).filter(Boolean);
    const approved = items.filter(s => s.status === 'approved').length;
    return { approved, total: 6, percent: Math.round((approved / 6) * 100) };
  };

  const getStatusInfo = (app: TutorApplication) => {
    if (app.writtenExamPassed && app.speakingExamPassed && !['verified', 'booked'].includes(app.identityStatus || '')) return { label: app.identityStatus === 'pending_review' ? 'ID Review Pending' : app.identityStatus === 'accepted' ? 'ID Accepted: Book Interview' : app.identityStatus === 'fraud' ? 'Identity Fraud: Banned' : 'ID Submission Required', class: 'review', icon: 'ri-shield-user-line' };
    if (app.status === 'certified') return { label: 'Application Approved', class: 'interview-pass', icon: 'ri-verified-badge-line' };
    if (app.status === 'pending_profile') return { label: 'Profile Review Pending', class: 'review', icon: 'ri-user-settings-line' };
    // Check interview result first
    if (app.interviewResult === 'pass') {
      return { label: 'Interview Passed', class: 'interview-pass', icon: 'ri-check-double-line' };
    }
    if (app.interviewResult === 'fail') {
      return { label: 'Interview Failed', class: 'interview-fail', icon: 'ri-close-circle-line' };
    }
    if (app.status === 'processing') {
      return { label: 'Speaking Assessment Processing', class: 'processing', icon: 'ri-loader-4-line' };
    }
    if (!app.writtenExamPassed) {
      return { label: 'Pending Written Exam', class: 'pending-written', icon: 'ri-file-text-line' };
    }
    if (!app.speakingExamPassed) {
      return { label: 'Pending Speaking Exam', class: 'pending-speaking', icon: 'ri-mic-line' };
    }
    if (app.status === 'interview_scheduled') return { label: 'Interview Scheduled', class: 'review', icon: 'ri-calendar-check-line' };
    if (app.status === 'interview_review') return { label: 'Interview Decision Pending', class: 'review', icon: 'ri-search-line' };
    return { label: 'Ready for Interview', class: 'review', icon: 'ri-calendar-schedule-line' };
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Date unavailable';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const selectFilter = (value: ApplicationFilter) => { setFilter(value); setPage(1); };
  const metrics = [
    { filter: 'all', count: stats?.total, label: 'Total Applications', icon: 'ri-file-user-line', tone: 'total' },
    { filter: 'pending_written', count: stats?.pendingWritten, label: 'Pending Written', icon: 'ri-file-text-line', tone: 'pending-written' },
    { filter: 'pending_speaking', count: stats?.pendingSpeaking, label: 'Pending Speaking', icon: 'ri-mic-line', tone: 'pending-speaking' },
    { filter: 'processing', count: stats?.processing, label: 'Processing', icon: 'ri-loader-4-line', tone: 'processing' },
    { filter: 'interview_passed', count: stats?.interviewPassed, label: 'Interview Passed', icon: 'ri-check-double-line', tone: 'interview-pass' },
    { filter: 'interview_failed', count: stats?.interviewFailed, label: 'Interview Failed', icon: 'ri-close-circle-line', tone: 'interview-fail' },
    { filter: 'pending_profile', count: stats?.pendingProfile, label: 'Profile Review', icon: 'ri-user-settings-line', tone: 'pending-profile' },
    { filter: 'certified', count: stats?.certified, label: 'Approved', icon: 'ri-verified-badge-line', tone: 'certified' },
  ] as const;

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
            Applications
            <span className="tab-badge">{stats?.total ?? '--'}</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
            onClick={() => setActiveTab('profiles')}
          >
            <i className="ri-user-settings-line"></i>
            Profile Reviews
            <span className="tab-badge">{stats?.pendingProfile ?? pendingProfiles.length}</span>
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
        {metrics.map(metric => <button type="button" key={metric.filter} className={`stat-card ${filter === metric.filter ? 'active' : ''}`}
          aria-label={metric.label} aria-pressed={filter === metric.filter} onClick={() => selectFilter(metric.filter)}>
          <span className={`stat-icon ${metric.tone}`}><i className={metric.icon} aria-hidden="true"/></span>
          <span className="stat-content"><span className="stat-number">{metric.count ?? '--'}</span><span className="stat-label">{metric.label}</span></span>
        </button>)}
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
          <h2>Applications ({stats ? totalApplications : '--'})</h2>
          <select className="application-stage-filter" aria-label="Application stage" value={filter} onChange={event => selectFilter(event.currentTarget.value as ApplicationFilter)}>
            <option value="all">All applications</option><option value="pending_written">Pending written</option>
            <option value="pending_speaking">Pending speaking</option><option value="processing">Speaking processing</option>
            <option value="pending_interview">Ready for interview</option><option value="interview_scheduled">Interview scheduled</option>
            <option value="interview_review">Interview decision pending</option><option value="interview_passed">Interview passed</option>
            <option value="interview_failed">Interview failed</option><option value="pending_profile">Profile review</option><option value="certified">Approved</option>
          </select>
          <button className="btn-refresh" onClick={() => void loadApplications()}>
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
            <div className="application-column-headings" aria-hidden="true">
              <span>Applicant</span><span>Application steps</span><span>Profile Submission</span><span>Profile Review</span><span>Status</span><span>Actions</span>
            </div>
            {applications.map(app => {
              const statusInfo = getStatusInfo(app);
              const profile = profileApplicationStatus(app.profileStatus);
              const idAccepted = ['accepted', 'booked', 'verified'].includes(app.identityStatus || '');
              const idStep = idAccepted ? 'Accepted' : app.identityStatus === 'pending_review' ? 'Awaiting review' : 'Required';
              return (
                <div className="application-card" key={app.id}>
                    <div className="applicant-info">
                      <div className="applicant-avatar">
                        {app.name?.charAt(0) || 'T'}
                      </div>
                      <div className="applicant-details">
                        <h3 className="applicant-name">{app.name}</h3>
                        <p className="applicant-email">{app.email}</p>
                        {app.registeredAt && <span className="applied-date">
                          <i className="ri-calendar-line"></i>
                          Applied {formatDate(app.registeredAt)}
                        </span>}
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
                      <div className={`exam-step identity-step ${idAccepted ? 'completed' : app.speakingExamPassed ? 'current' : 'pending'}`} title={`ID Submission: ${idStep}`} aria-label={`ID Submission: ${idStep}`}>
                        <div className="step-icon"><i className={idAccepted ? 'ri-check-line' : app.identityStatus === 'pending_review' ? 'ri-time-line' : 'ri-id-card-line'} aria-hidden="true"/></div>
                        <span className="step-label">ID Submission</span>
                      </div>
                      <div className="step-connector"></div>
                      <div className={`exam-step ${app.interviewResult === 'pass' ? 'completed' : 'pending'}`}>
                        <div className="step-icon">
                          <i className={app.interviewResult === 'fail' ? 'ri-close-circle-line' : 'ri-video-chat-line'} aria-hidden="true"/>
                        </div>
                        <span className="step-label">Interview</span>
                      </div>
                    </div>
                    <dl className="application-profile-column" data-profile-column="submission">
                      <dt>Profile Submission</dt>
                      <dd><span className={`profile-stage-badge ${profile.submission === 'Submitted' ? 'submitted' : 'neutral'}`}>{profile.submission}</span></dd>
                    </dl>
                    <dl className="application-profile-column" data-profile-column="review">
                      <dt>Profile Review</dt>
                      <dd><span className={`profile-stage-badge ${profile.tone}`}>{profile.review}</span></dd>
                    </dl>
                    <span className={`status-badge ${statusInfo.class}`}>
                      <i className={statusInfo.icon}></i>
                      {statusInfo.label}
                    </span>
                    <div className="card-actions">
                      {app.interviewSlotId && <a className="btn-action view" href={`/interview-room/${encodeURIComponent(app.interviewSlotId)}`}>
                        <i className="ri-edit-line" aria-hidden="true"/> Review interview
                      </a>}
                      {app.writtenExamPassed && app.speakingExamPassed && app.identityStatus === 'accepted' && !app.interviewSlotId && (
                        <a href="/interviews" className="btn-action schedule">
                          <i className="ri-calendar-schedule-line" aria-hidden="true"></i>
                          Schedule Interview
                        </a>
                      )}
                      {app.speakingExamPassed && !idAccepted && app.identityStatus === 'pending_review' && <a href="/identity-reviews" className="btn-action view"><i className="ri-shield-user-line" aria-hidden="true"/>Review ID</a>}
                    </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && applications.length === 0 && !error && (
          <div className="empty-state">
            <i className="ri-file-search-line"></i>
            <p>No applications found</p>
          </div>
        )}
        {!loading && stats && <nav className="applications-pagination" aria-label="Application pages">
          <span>{totalApplications === 0 ? '0 applications' : `${(page - 1) * 10 + 1}-${Math.min(page * 10, totalApplications)} of ${totalApplications}`}</span>
          <div><button type="button" aria-label="Previous application page" title="Previous page" disabled={page <= 1} onClick={() => setPage(current => current - 1)}><i className="ri-arrow-left-s-line" aria-hidden="true"/></button>
          <span>Page {page} of {pageCount}</span>
          <button type="button" aria-label="Next application page" title="Next page" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)}><i className="ri-arrow-right-s-line" aria-hidden="true"/></button></div>
        </nav>}
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
                  role="button" tabIndex={0} aria-label={`Review ${profile.name}`}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setShowProfileModal(profile); setError(''); } }}
                  onClick={() => {
                    setShowProfileModal(profile);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="profile-card-header">
                    <div className="profile-avatar-wrapper">
<ProfileAvatar src={profile.profilePicture} name={profile.name} className="profile-avatar review-avatar" fallback={profile.name.charAt(0)}/>
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
<ProfileAvatar src={tutor.profilePicture} name={tutor.name} className="profile-avatar review-avatar" fallback={tutor.name.charAt(0)}/>
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
                          <i className={getChangeIcon(changeField(change))}></i>
                          <span>{getChangeLabel(changeField(change))}</span>
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
                  <ProfileAvatar src={showChangesModal.profilePicture} name={showChangesModal.name} className="modal-avatar review-avatar" fallback={showChangesModal.name.charAt(0)}/>
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
                      <i className={getChangeIcon(changeField(change))}></i>
                      <h4>{getChangeLabel(changeField(change))}</h4>
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
        <dialog ref={profileDialog} className="application-profile-dialog" aria-labelledby="profile-review-title" onCancel={event => { if (reviewingItem) event.preventDefault(); else { setShowProfileModal(null); setError(''); } }} onClick={event => { if (event.target === event.currentTarget && !reviewingItem) { setShowProfileModal(null); setError(''); } }}>
          <div className="profile-modal granular-review" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 id="profile-review-title">Review Profile</h2>
              <div className="approval-progress">
                <span className="progress-text">
                  {getApprovalProgress(showProfileModal.profileItemStatuses).approved}/{getApprovalProgress(showProfileModal.profileItemStatuses).total} approved
                </span>
                <div className="progress-bar" role="progressbar" aria-label="Profile approval" aria-valuemin={0} aria-valuemax={getApprovalProgress(showProfileModal.profileItemStatuses).total} aria-valuenow={getApprovalProgress(showProfileModal.profileItemStatuses).approved}>
                  <div 
                    className="progress-fill" 
                    style={{ width: `${getApprovalProgress(showProfileModal.profileItemStatuses).percent}%` }}
                  />
                </div>
              </div>
              <button className="modal-close" aria-label="Close profile review" title="Close profile review" disabled={!!reviewingItem} onClick={() => { setShowProfileModal(null); setItemRejectReasons({ nickname: '', profilePicture: '', videoIntro: '', bio: '', education: '', interests: '' }); setError(''); }}>
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
                <ProfileAvatar src={showProfileModal.profilePicture} name={showProfileModal.name} className="modal-avatar review-avatar" fallback={showProfileModal.name.charAt(0)}/>
                <div className="modal-profile-info">
                  <h3>{showProfileModal.name}</h3>
                  <p>{showProfileModal.email}</p>
                  <span className="submitted-date">
                    <i className="ri-time-line"></i>
                    Submitted {formatDate(showProfileModal.submittedAt)}
                  </span>
                </div>
              </div>

              <section className={`review-item-card ${showProfileModal.profileItemStatuses?.nickname?.status || 'pending'}`} aria-label="Preferred nickname review">
                <div className="item-header">
                  <div className="item-title"><i className="ri-user-line"/><h4>Preferred nickname</h4></div>
                  <span className={`item-status ${showProfileModal.profileItemStatuses?.nickname?.status || 'pending'}`}>{showProfileModal.profileItemStatuses?.nickname?.status || 'pending'}</span>
                </div>
                <div className="item-content"><p>{showProfileModal.nickname || 'Not provided'}</p><p className="missing">Check readability, professional wording, no surname or contact details, and consistency with the introduction video.</p></div>
                {showProfileModal.profileItemStatuses?.nickname?.status !== 'approved' && <div className="item-actions">
                  <input className="reject-input" aria-label="Nickname rejection reason" value={itemRejectReasons.nickname} onChange={e => setItemRejectReasons(prev => ({ ...prev, nickname: (e.target as HTMLInputElement).value }))} placeholder="Rejection reason (required if rejecting)"/>
                  <div className="action-buttons">
                    <button className="btn-item-reject" disabled={reviewingItem === 'nickname'} onClick={() => handleReviewItem(showProfileModal.id, 'nickname', 'reject')}><i className="ri-close-line" aria-hidden="true"/> Reject</button>
                    <button className="btn-item-approve" disabled={reviewingItem === 'nickname' || !showProfileModal.nickname} onClick={() => handleReviewItem(showProfileModal.id, 'nickname', 'approve')}><i className="ri-check-line" aria-hidden="true"/> Approve</button>
                  </div>
                </div>}
                {showProfileModal.profileItemStatuses?.nickname?.rejectionReason && <p className="rejection-reason">{showProfileModal.profileItemStatuses.nickname.rejectionReason}</p>}
              </section>
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
                    <ReviewPhoto src={showProfileModal.profilePicture}/>
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
                    <ReviewVideo src={showProfileModal.videoIntroUrl}/>
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
        </dialog>
      )}
    </div>
  );
};

export default ApplicationsPage;
