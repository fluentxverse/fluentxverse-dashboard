import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { adminApi, type DashboardStats, type ExamStats, type PendingTutor, type RecentActivity } from '../api/admin.api';
import { interviewApi } from '../api/interview.api';
import './DashboardPage.css';
import { AdminArt, type AdminArtName } from '../components/AdminArt';
import { ActivityTimestamp } from '../components/ActivityTimestamp';
import { useActivityClock } from '../hooks/useActivityClock';
import { activityTime } from '../utils/activityTime';

const metricArt: Record<string, AdminArtName> = {
  'fa-chalkboard-teacher':'community', 'fa-certificate':'training', 'fa-user-graduate':'training',
  'fa-clock':'schedule', 'fa-file-alt':'training', 'fa-calendar-check':'schedule',
  'fa-chart-line':'growth', 'fa-book-open':'training',
};

interface StatCard {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: { value: number; isPositive: boolean };
  link?: string;
}

interface QuickAction {
  title: string;
  icon: string;
  color: string;
  link: string;
  badge?: number;
}

interface InterviewStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  passRate: number;
  avgScores: {
    grammar: number;
    fluency: number;
    pronunciation: number;
    vocabulary: number;
    professionalism: number;
    overall: number;
  };
  weeklyData: { week: string; passed: number; failed: number }[];
  rubricDistribution: { category: string; scores: number[] }[];
}

interface TodayInterview {
  id: string;
  time: string;
  tutorId: string;
  tutorName: string;
  tutorEmail: string;
  status: string;
}

const REQUEST_TIMEOUT_MS = 12000;

const DashboardPage = () => {
  const { user } = useAuthContext();
  const now = useActivityClock();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [examStats, setExamStats] = useState<ExamStats | null>(null);
  const [interviewStats, setInterviewStats] = useState<InterviewStats | null>(null);
  const [todayQueue, setTodayQueue] = useState<TodayInterview[]>([]);
  const [pendingTutors, setPendingTutors] = useState<PendingTutor[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    loadDashboardData();
    
    // Refresh data every 60 seconds
    const interval = setInterval(loadDashboardData, 60000);
    return () => clearInterval(interval);
  }, []);

  const safeRequest = async <T,>(promise: Promise<T>, fallback: T) => {
    let timeoutId: number;
    return new Promise<{ value: T; ok: boolean }>((resolve) => {
      timeoutId = window.setTimeout(() => resolve({ value: fallback, ok: false }), REQUEST_TIMEOUT_MS);
      promise
        .then((value) => {
          window.clearTimeout(timeoutId);
          resolve({ value, ok: true });
        })
        .catch(() => {
          window.clearTimeout(timeoutId);
          resolve({ value: fallback, ok: false });
        });
    });
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      if (!hasLoadedOnce.current) {
        setError(null);
      }

      const [
        statsRes,
        examRes,
        tutorsRes,
        activityRes,
        interviewRes,
        queueRes
      ] = await Promise.all([
        safeRequest(adminApi.getStats(), null),
        safeRequest(adminApi.getExamStats(), null),
        safeRequest(adminApi.getPendingTutors(5), []),
        safeRequest(adminApi.getRecentActivity(5), []),
        safeRequest(interviewApi.getStats(), null),
        safeRequest(interviewApi.getTodayQueue(), [])
      ]);

      if (statsRes.ok) setStats(statsRes.value);
      if (examRes.ok) setExamStats(examRes.value);
      if (tutorsRes.ok) setPendingTutors(tutorsRes.value);
      if (activityRes.ok) setRecentActivities(activityRes.value);
      if (interviewRes.ok) setInterviewStats(interviewRes.value);
      if (queueRes.ok) setTodayQueue(queueRes.value);

      const hasAnySuccess = statsRes.ok || examRes.ok || tutorsRes.ok || activityRes.ok || interviewRes.ok || queueRes.ok;
      if (hasAnySuccess) {
        hasLoadedOnce.current = true;
        setError(null);
        setLastUpdated(new Date());
      } else if (!hasLoadedOnce.current) {
        setError('Failed to load dashboard data. Please try again.');
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      if (!hasLoadedOnce.current) {
        setError('Failed to load dashboard data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const statCards: StatCard[] = stats ? [
    {
      title: 'Total Tutors',
      value: stats.totalTutors,
      icon: 'fa-chalkboard-teacher',
      color: '#0245ae',
      link: '/tutors'
    },
    {
      title: 'Certified Tutors',
      value: stats.certifiedTutors,
      icon: 'fa-certificate',
      color: '#10b981',
      link: '/tutors?tab=certified'
    },
    {
      title: 'Total Students',
      value: stats.totalStudents,
      icon: 'fa-user-graduate',
      color: '#8b5cf6',
      link: '/students'
    },
    {
      title: 'Pending Tutors',
      value: stats.pendingTutors,
      icon: 'fa-clock',
      color: '#f59e0b',
      link: '/applications'
    }
  ] : [];

  const quickActions: QuickAction[] = [
    {
      title: 'Review Applications',
      icon: 'fa-file-alt',
      color: '#0245ae',
      link: '/applications',
      badge: stats?.pendingTutors || 0
    },
    {
      title: 'Schedule Interviews',
      icon: 'fa-calendar-check',
      color: '#10b981',
      link: '/interviews',
      badge: todayQueue.filter(q => q.status === 'scheduled').length
    },
    {
      title: 'View Analytics',
      icon: 'fa-chart-line',
      color: '#8b5cf6',
      link: '/analytics'
    },
    {
      title: 'Lesson Materials',
      icon: 'fa-book-open',
      color: '#f59e0b',
      link: '/lesson-material-maker'
    },
    {
      title: 'Settings',
      icon: 'fa-cog',
      color: '#6b7280',
      link: '/settings'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_written':
        return <span className="status-badge pending">Pending Written</span>;
      case 'pending_speaking':
        return <span className="status-badge in-progress">Pending Speaking</span>;
      case 'processing':
        return <span className="status-badge processing">Processing</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'exam_passed':
        return 'activity-icon success';
      case 'exam_failed':
        return 'activity-icon danger';
      case 'tutor_registered':
        return 'activity-icon primary';
      case 'student_joined':
        return 'activity-icon info';
      case 'booking':
        return 'activity-icon warning';
      default:
        return 'activity-icon';
    }
  };

  const getActivityIconClass = (type: string) => {
    switch (type) {
      case 'tutor_registered':
        return 'fa-user-plus';
      case 'student_joined':
        return 'fa-graduation-cap';
      case 'exam_passed':
        return 'fa-check-circle';
      case 'exam_failed':
        return 'fa-times-circle';
      case 'booking':
        return 'fa-calendar-check';
      default:
        return 'fa-bell';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const passRate = Math.max(0, Math.min(100, Math.round(interviewStats?.passRate || 0)));
  const passRateCircumference = 2 * Math.PI * 40;
  const passRateOffset = passRateCircumference * (1 - passRate / 100);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading-state">
          <i className="fas fa-spinner fa-spin"></i>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="error-state">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-btn">
            <i className="fas fa-redo"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div className="page-header-content">
          <h1>
            <AdminArt name="home" className="page-art" /> Platform overview</h1>
          <p>{getGreeting()}, {user?.username || 'Admin'} · {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}</p>
        </div>
        <div className="page-header-actions">
          <div className="system-status">
            <span className="status-indicator online"></span>
            <span className="status-text">{lastUpdated ? 'Data refreshed' : 'Awaiting data'}</span>
          </div>
          <button 
            className="refresh-btn" 
            onClick={loadDashboardData} 
            disabled={loading}
            title={lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Refresh data'}
          >
            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
            {lastUpdated && (
              <span className="last-updated">
                Updated {activityTime(lastUpdated.toISOString(), now).relative}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <a 
            href={stat.link} 
            className="stat-card" 
            key={index} 
            style={{ '--accent-color': stat.color } as any}
          >
            <div className="stat-icon">
              <AdminArt name={metricArt[stat.icon] || 'growth'} />
            </div>
            <div className="stat-content">
              <h3>{stat.title}</h3>
              <div className="stat-value">{stat.value}</div>
              {stat.trend && (
                <div className={`stat-trend ${stat.trend.isPositive ? 'positive' : 'negative'}`}>
                  <i className={`fas fa-arrow-${stat.trend.isPositive ? 'up' : 'down'}`}></i>
                  {stat.trend.value}% this week
                </div>
              )}
            </div>
            <div className="stat-arrow">
              <i className="ri-arrow-right-up-line" aria-hidden="true"></i>
            </div>
          </a>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <div className="section-header">
          <h2>Quick actions</h2>
        </div>
        <div className="quick-actions-grid">
          {quickActions.map((action, index) => (
            <a 
              href={action.link} 
              className="quick-action-card" 
              key={index}
              style={{ '--action-color': action.color } as any}
            >
              <div className="action-icon">
                {metricArt[action.icon] ? <AdminArt name={metricArt[action.icon]} /> : <i className="ri-settings-3-line" aria-hidden="true"></i>}
              </div>
              <span className="action-title">{action.title}</span>
              {typeof action.badge === 'number' && action.badge > 0 && (
                <span className="action-badge">{action.badge}</span>
              )}
            </a>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Exam Statistics */}
        {examStats && (
          <div className="dashboard-card exam-stats-card">
            <div className="card-header">
              <h2><AdminArt name="training" /> Exam Statistics</h2>
            </div>
            <div className="card-body">
              <div className="exam-stats-grid">
                <div className="exam-stat-section">
                  <h4>Written Exams</h4>
                  <div className="progress-stats">
                    <div className="progress-bar-container">
                      {examStats.writtenExams.total > 0 && (
                        <div 
                          className="progress-bar passed" 
                          style={{ width: `${(examStats.writtenExams.passed / examStats.writtenExams.total) * 100}%` }}
                        ></div>
                      )}
                    </div>
                    <div className="progress-labels">
                      <span className="passed-label">
                        <i className="fas fa-check-circle"></i> {examStats.writtenExams.passed} Passed
                      </span>
                      <span className="failed-label">
                        <i className="fas fa-times-circle"></i> {examStats.writtenExams.failed} Failed
                      </span>
                    </div>
                  </div>
                </div>
                <div className="exam-stat-section">
                  <h4>Speaking Exams</h4>
                  <div className="progress-stats">
                    <div className="progress-bar-container">
                      {examStats.speakingExams.total > 0 && (
                        <>
                          <div 
                            className="progress-bar passed" 
                            style={{ width: `${(examStats.speakingExams.passed / examStats.speakingExams.total) * 100}%` }}
                          ></div>
                          <div 
                            className="progress-bar processing" 
                            style={{ 
                              width: `${(examStats.speakingExams.processing / examStats.speakingExams.total) * 100}%`,
                              left: `${(examStats.speakingExams.passed / examStats.speakingExams.total) * 100}%`
                            }}
                          ></div>
                        </>
                      )}
                    </div>
                    <div className="progress-labels">
                      <span className="passed-label">
                        <i className="fas fa-check-circle"></i> {examStats.speakingExams.passed} Passed
                      </span>
                      <span className="processing-label">
                        <i className="fas fa-spinner fa-spin"></i> {examStats.speakingExams.processing} Processing
                      </span>
                      <span className="failed-label">
                        <i className="fas fa-times-circle"></i> {examStats.speakingExams.failed} Failed
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Interview Analytics */}
        {interviewStats && (
          <div className="dashboard-card interview-analytics-card">
            <div className="card-header">
              <h2><AdminArt name="growth" /> Interview Analytics</h2>
              <a href="/interviews" className="view-all-link">View Schedule</a>
            </div>
            <div className="card-body">
              {/* Pass Rate Donut */}
              <div className="interview-stats-summary">
                <div className="donut-chart-container">
                  <svg viewBox="0 0 100 100" className="donut-chart">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-color)" strokeWidth="12" />
                    <circle 
                      cx="50" cy="50" r="40" fill="none" 
                      stroke="#10b981" strokeWidth="12"
                      strokeDasharray={passRateCircumference}
                      strokeDashoffset={passRateOffset}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    <text x="50" y="50" textAnchor="middle" dy="0.35em" className="donut-text">
                      {passRate}%
                    </text>
                  </svg>
                  <div className="donut-label">Pass Rate</div>
                </div>
                <div className="interview-counts">
                  <div className="count-item passed">
                    <i className="fas fa-check-circle"></i>
                    <span className="count-value">{interviewStats.passed}</span>
                    <span className="count-label">Passed</span>
                  </div>
                  <div className="count-item failed">
                    <i className="fas fa-times-circle"></i>
                    <span className="count-value">{interviewStats.failed}</span>
                    <span className="count-label">Failed</span>
                  </div>
                  <div className="count-item pending">
                    <i className="fas fa-clock"></i>
                    <span className="count-value">{interviewStats.pending}</span>
                    <span className="count-label">Pending</span>
                  </div>
                </div>
              </div>

              {/* Weekly Bar Chart */}
              {interviewStats.weeklyData.length > 0 && (
                <div className="weekly-chart">
                  <h4>Weekly Interviews</h4>
                  <div className="bar-chart">
                    {interviewStats.weeklyData.map((week, idx) => {
                      const maxVal = Math.max(...interviewStats.weeklyData.flatMap(w => [w.passed, w.failed]), 1);
                      return (
                        <div className="bar-group" key={idx}>
                          <div className="bars">
                            <div 
                              className="bar passed" 
                              style={{ height: `${(week.passed / maxVal) * 100}%` }}
                              title={`${week.passed} passed`}
                            ></div>
                            <div 
                              className="bar failed" 
                              style={{ height: `${(week.failed / maxVal) * 100}%` }}
                              title={`${week.failed} failed`}
                            ></div>
                          </div>
                          <span className="bar-label">{new Date(week.week).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="chart-legend">
                    <span className="legend-item passed"><span className="legend-dot"></span> Passed</span>
                    <span className="legend-item failed"><span className="legend-dot"></span> Failed</span>
                  </div>
                </div>
              )}

              {/* Average Scores */}
              <div className="avg-scores">
                <h4>Average Rubric Scores</h4>
                <div className="scores-grid">
                  {[
                    { key: 'grammar', label: 'Grammar', icon: 'fa-spell-check' },
                    { key: 'fluency', label: 'Fluency', icon: 'fa-water' },
                    { key: 'pronunciation', label: 'Pronunciation', icon: 'fa-volume-up' },
                    { key: 'vocabulary', label: 'Vocabulary', icon: 'fa-book' },
                    { key: 'professionalism', label: 'Professional', icon: 'fa-user-tie' }
                  ].map(({ key, label, icon }) => (
                    <div className="score-item" key={key}>
                      <div className="score-icon"><i className={`fas ${icon}`}></i></div>
                      <div className="score-bar-bg">
                        <div 
                          className="score-bar-fill" 
                          style={{ width: `${((interviewStats.avgScores as any)[key] / 5) * 100}%` }}
                        ></div>
                      </div>
                      <span className="score-value">{(interviewStats.avgScores as any)[key]}</span>
                    </div>
                  ))}
                </div>
                <div className="overall-score">
                  <span>Overall Average</span>
                  <strong>{interviewStats.avgScores.overall}/5</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Today's Interview Queue */}
        <div className="dashboard-card today-queue-card">
          <div className="card-header">
            <h2><AdminArt name="schedule" /> Today's Interviews</h2>
            <span className="queue-count">{todayQueue.length} scheduled</span>
          </div>
          <div className="card-body">
            {todayQueue.length > 0 ? (
              <div className="queue-list">
                {todayQueue.map((interview) => {
                  // Check if interview time has passed (give 1 hour window)
                  const now = new Date();
                  const [hours, minutes] = interview.time.split(':').map(Number);
                  const interviewTime = new Date();
                  // Handle 12-hour format with AM/PM
                  const timeParts = interview.time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                  if (timeParts) {
                    let h = parseInt(timeParts[1]);
                    const m = parseInt(timeParts[2]);
                    const ampm = timeParts[3];
                    if (ampm) {
                      if (ampm.toUpperCase() === 'PM' && h !== 12) h += 12;
                      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0;
                    }
                    interviewTime.setHours(h, m, 0, 0);
                  }
                  // Add 1 hour grace period
                  interviewTime.setHours(interviewTime.getHours() + 1);
                  const isPast = now > interviewTime;
                  const isActive = interview.status === 'in_progress';
                  
                  return (
                    <div className={`queue-item ${isPast && !isActive ? 'past' : ''}`} key={interview.id}>
                      <div className="queue-time">
                        <i className="fas fa-clock"></i>
                        {interview.time}
                      </div>
                      <div className="queue-tutor">
                        <div className="tutor-avatar">
                          {interview.tutorName.charAt(0)}
                        </div>
                        <div className="tutor-info">
                          <span className="tutor-name">{interview.tutorName}</span>
                          <span className="tutor-email">{interview.tutorEmail}</span>
                        </div>
                      </div>
                      <div className="queue-status">
                        <span className={`status-dot ${interview.status} ${isPast && !isActive ? 'missed' : ''}`}></span>
                        {isActive ? 'In Progress' : isPast ? 'Missed' : 'Scheduled'}
                      </div>
                      {isPast && !isActive ? (
                        <span className="join-btn disabled">
                          <i className="fas fa-clock"></i> Passed
                        </span>
                      ) : (
                        <a 
                          href={`/interview/room/${interview.id}?tutorId=${interview.tutorId}`} 
                          className="join-btn"
                        >
                          <i className="fas fa-video"></i> Join
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <AdminArt name="schedule" />
                <p>No interviews scheduled for today</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="dashboard-card activity-card">
          <div className="card-header">
            <h2><AdminArt name="growth" /> Recent Activity</h2>
          </div>
          <div className="card-body">
            {recentActivities.length > 0 ? (
              <div className="activity-list">
                {recentActivities.map((activity) => (
                  <div className="activity-item" key={activity.id}>
                    <div className={getActivityIcon(activity.type)}>
                      <i className={`fas ${getActivityIconClass(activity.type)}`}></i>
                    </div>
                    <div className="activity-content">
                      <p>{activity.message}</p>
                      <ActivityTimestamp timestamp={activity.timestamp} now={now} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Tutors */}
        <div className="dashboard-card pending-tutors-card">
          <div className="card-header">
            <h2><AdminArt name="community" /> Pending Tutors</h2>
            <a href="/applications" className="view-all-link">View All</a>
          </div>
          <div className="card-body">
            {pendingTutors.length > 0 ? (
              <div className="pending-tutors-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Registered</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingTutors.map((tutor) => (
                      <tr key={tutor.id}>
                        <td className="tutor-name">{tutor.name}</td>
                        <td className="tutor-email">{tutor.email}</td>
                        <td className="tutor-date">{formatDate(tutor.registeredAt)}</td>
                        <td>{getStatusBadge(tutor.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No pending tutors</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
