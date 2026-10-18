import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { adminApi, AnalyticsData, SuspensionAnalytics } from '../api/admin.api';
import { BarChart, DonutChart, ProgressBar } from '../Components/SimpleChart';
import './AnalyticsPage.css';

const AnalyticsPage = () => {
  const [period, setPeriod] = useState<string>('week');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [suspensionAnalytics, setSuspensionAnalytics] = useState<SuspensionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'suspensions'>('overview');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [analyticsData, suspensionData] = await Promise.all([
        adminApi.getAnalytics(period),
        adminApi.getSuspensionAnalytics()
      ]);
      
      setAnalytics(analyticsData);
      setSuspensionAnalytics(suspensionData);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'suspended': return 'ri-forbid-line';
      case 'unsuspended': return 'ri-checkbox-circle-line';
      case 'auto-unsuspended': return 'ri-time-line';
      default: return 'ri-question-line';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'suspended': return '#ef4444';
      case 'unsuspended': return '#22c55e';
      case 'auto-unsuspended': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-state">
          <i className="ri-loader-4-line spinning"></i>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-page">
        <div className="error-state">
          <i className="ri-error-warning-line"></i>
          <p>{error}</p>
          <button onClick={loadAnalytics} className="retry-btn">
            <i className="ri-refresh-line"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      <div className="page-header">
        <div className="header-content">
          <h1><i className="ri-bar-chart-box-line"></i> Analytics Dashboard</h1>
          <p>Platform performance insights and statistics</p>
        </div>
        <div className="header-actions">
          <div className="tab-buttons">
            <button 
              className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <i className="ri-dashboard-line"></i> Overview
            </button>
            <button 
              className={`tab-btn ${activeTab === 'suspensions' ? 'active' : ''}`}
              onClick={() => setActiveTab('suspensions')}
            >
              <i className="ri-shield-line"></i> Suspensions
            </button>
          </div>
          <select 
            className="period-select" 
            value={period}
            onChange={(e) => setPeriod((e.target as HTMLSelectElement).value)}
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {activeTab === 'overview' && analytics && (
        <>
          {/* Summary Stats */}
          <div className="summary-stats">
            <div className="stat-card">
              <div className="stat-icon blue">
                <i className="ri-user-3-line"></i>
              </div>
              <div className="stat-info">
                <span className="stat-value">{analytics.summary.totalTutors}</span>
                <span className="stat-label">Total Tutors</span>
                {analytics.summary.newTutors > 0 && (
                  <span className="stat-badge positive">
                    +{analytics.summary.newTutors} new
                  </span>
                )}
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon green">
                <i className="ri-graduation-cap-line"></i>
              </div>
              <div className="stat-info">
                <span className="stat-value">{analytics.summary.totalStudents}</span>
                <span className="stat-label">Total Students</span>
                {analytics.summary.newStudents > 0 && (
                  <span className="stat-badge positive">
                    +{analytics.summary.newStudents} new
                  </span>
                )}
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon red">
                <i className="ri-forbid-line"></i>
              </div>
              <div className="stat-info">
                <span className="stat-value">{analytics.summary.suspendedTutors}</span>
                <span className="stat-label">Suspended Tutors</span>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon orange">
                <i className="ri-user-unfollow-line"></i>
              </div>
              <div className="stat-info">
                <span className="stat-value">{analytics.summary.suspendedStudents}</span>
                <span className="stat-label">Suspended Students</span>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="charts-grid">
            {/* Registration Trends */}
            <div className="chart-card wide">
              <div className="card-header">
                <h3><i className="ri-line-chart-line"></i> Registration Trends</h3>
              </div>
              <div className="card-body">
                <BarChart 
                  data={analytics.tutorTrend.map(t => ({
                    label: formatDate(t.date),
                    value: t.count,
                    color: '#0245ae'
                  }))}
                  height={200}
                />
              </div>
            </div>

            {/* Exam Statistics */}
            <div className="chart-card">
              <div className="card-header">
                <h3><i className="ri-file-list-3-line"></i> Exam Pass Rates</h3>
              </div>
              <div className="card-body">
                {analytics.examStats.length > 0 ? (
                  analytics.examStats.map((exam, i) => (
                    <ProgressBar 
                      key={i}
                      label={exam.type === 'written' ? 'Written Exam' : 'Speaking Exam'}
                      value={exam.passed}
                      max={exam.total}
                      color={exam.type === 'written' ? '#0245ae' : '#22c55e'}
                    />
                  ))
                ) : (
                  <div className="no-data">No exam data available</div>
                )}
              </div>
            </div>

            {/* Suspension Activity */}
            <div className="chart-card">
              <div className="card-header">
                <h3><i className="ri-shield-line"></i> Suspension Activity</h3>
              </div>
              <div className="card-body">
                <DonutChart 
                  data={[
                    { 
                      label: 'Tutors Suspended', 
                      value: analytics.suspensionStats.filter(s => s.action === 'suspended' && s.targetType === 'tutor').reduce((sum, s) => sum + s.count, 0),
                      color: '#ef4444'
                    },
                    { 
                      label: 'Students Suspended', 
                      value: analytics.suspensionStats.filter(s => s.action === 'suspended' && s.targetType === 'student').reduce((sum, s) => sum + s.count, 0),
                      color: '#f59e0b'
                    },
                    { 
                      label: 'Unsuspended', 
                      value: analytics.suspensionStats.filter(s => s.action.includes('unsuspended')).reduce((sum, s) => sum + s.count, 0),
                      color: '#22c55e'
                    }
                  ]}
                  size={150}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'suspensions' && suspensionAnalytics && (
        <>
          {/* Suspension Reason Distribution */}
          <div className="suspension-section">
            <div className="section-header">
              <h2><i className="ri-pie-chart-line"></i> Suspension Reasons</h2>
            </div>
            <div className="reason-grid">
              {suspensionAnalytics.reasonDistribution.length > 0 ? (
                suspensionAnalytics.reasonDistribution.map((reason, i) => (
                  <div className="reason-card" key={i}>
                    <div className="reason-count">{reason.count}</div>
                    <div className="reason-text">{reason.reason}</div>
                  </div>
                ))
              ) : (
                <div className="no-data">No suspension reasons recorded yet</div>
              )}
            </div>
          </div>

          {/* Recent Suspension Activity */}
          <div className="suspension-section">
            <div className="section-header">
              <h2><i className="ri-history-line"></i> Recent Suspension Activity</h2>
            </div>
            <div className="activity-list">
              {suspensionAnalytics.recentLogs.length > 0 ? (
                suspensionAnalytics.recentLogs.slice(0, 20).map((log, i) => (
                  <div className={`activity-item ${log.action}`} key={i}>
                    <div className="activity-icon" style={{ color: getActionColor(log.action) }}>
                      <i className={getActionIcon(log.action)}></i>
                    </div>
                    <div className="activity-content">
                      <div className="activity-header">
                        <span className="activity-action">
                          {log.action === 'suspended' && 'Suspended'}
                          {log.action === 'unsuspended' && 'Unsuspended'}
                          {log.action === 'auto-unsuspended' && 'Auto-Unsuspended'}
                        </span>
                        <span className="activity-type">{log.targetType}</span>
                      </div>
                      <div className="activity-reason">{log.reason}</div>
                      <div className="activity-meta">
                        <span className="activity-time">
                          <i className="ri-time-line"></i> {formatDateTime(log.createdAt)}
                        </span>
                        {log.adminName && (
                          <span className="activity-admin">
                            <i className="ri-user-line"></i> by {log.adminName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-data">
                  <i className="ri-shield-check-line"></i>
                  <p>No suspension activity recorded yet</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsPage;
