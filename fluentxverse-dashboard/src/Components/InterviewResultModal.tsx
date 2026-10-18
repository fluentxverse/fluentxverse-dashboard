import { useState, useEffect } from 'preact/hooks';
import { interviewApi } from '@api/interview.api';
import './InterviewResultModal.css';

interface InterviewResult {
  id: string;
  date: string;
  time: string;
  status: string;
  result: 'pass' | 'fail' | null;
  rubricScores: {
    grammar: number;
    fluency: number;
    pronunciation: number;
    vocabulary: number;
    professionalism: number;
  } | null;
  notes: string;
  timestamps: { time: string; note: string }[];
  completedAt: string | null;
  recordingUrl: string | null;
  tutorName?: string;
  tutorEmail?: string;
}

interface InterviewResultModalProps {
  tutorId: string;
  tutorName?: string;
  onClose: () => void;
}

const InterviewResultModal = ({ tutorId, tutorName, onClose }: InterviewResultModalProps) => {
  const [result, setResult] = useState<InterviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResult = async () => {
      try {
        const data = await interviewApi.getResult(tutorId);
        setResult(data as InterviewResult);
      } catch (err: any) {
        setError(err.message || 'Failed to load interview result');
      } finally {
        setLoading(false);
      }
    };
    loadResult();
  }, [tutorId]);

  const rubricLabels: Record<string, { label: string; icon: string }> = {
    grammar: { label: 'Grammar & Accuracy', icon: 'ri-text' },
    fluency: { label: 'Fluency & Flow', icon: 'ri-speed-line' },
    pronunciation: { label: 'Pronunciation', icon: 'ri-volume-up-line' },
    vocabulary: { label: 'Vocabulary Range', icon: 'ri-book-open-line' },
    professionalism: { label: 'Professionalism', icon: 'ri-user-star-line' }
  };

  const getAverageScore = (scores: Record<string, number> | null) => {
    if (!scores) return 0;
    const values = Object.values(scores);
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog interview-result-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><i className="ri-file-list-3-line"></i> Interview Result</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="ri-close-line"></i>
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <i className="ri-loader-4-line ri-spin"></i>
              <p>Loading interview result...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <i className="ri-error-warning-line"></i>
              <p>{error}</p>
            </div>
          ) : !result ? (
            <div className="empty-state">
              <i className="ri-file-unknow-line"></i>
              <p>No interview result found for this tutor</p>
            </div>
          ) : (
            <>
              {/* Tutor Info */}
              <div className="result-tutor-info">
                <div className="tutor-avatar">
                  {tutorName?.charAt(0) || 'T'}
                </div>
                <div className="tutor-details">
                  <h3>{tutorName || 'Unknown Tutor'}</h3>
                  {result.completedAt && (
                    <p className="interview-date">
                      <i className="ri-calendar-line"></i>
                      {formatDate(result.completedAt)}
                    </p>
                  )}
                </div>
                <div className={`result-badge ${result.result}`}>
                  {result.result === 'pass' ? (
                    <><i className="ri-check-double-line"></i> Passed</>
                  ) : (
                    <><i className="ri-close-circle-line"></i> Failed</>
                  )}
                </div>
              </div>

              {/* Rubric Scores */}
              {result.rubricScores && (
                <div className="result-section">
                  <h4><i className="ri-star-line"></i> Evaluation Scores</h4>
                  <div className="rubric-results">
                    {Object.entries(result.rubricScores).map(([key, score]) => {
                      const info = rubricLabels[key] || { label: key, icon: 'ri-checkbox-blank-line' };
                      return (
                        <div key={key} className="rubric-result-item">
                          <div className="rubric-result-label">
                            <i className={info.icon}></i>
                            <span>{info.label}</span>
                          </div>
                          <div className="rubric-result-score">
                            <div className="score-bar">
                              <div className="score-fill" style={{ width: `${(score / 5) * 100}%` }}></div>
                            </div>
                            <span className="score-value">{score}/5</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="rubric-result-average">
                      <span>Average Score</span>
                      <strong>{getAverageScore(result.rubricScores)}/5</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Timestamped Notes */}
              {result.timestamps && result.timestamps.length > 0 && (
                <div className="result-section">
                  <h4><i className="ri-time-line"></i> Timestamped Notes</h4>
                  <div className="timestamp-results">
                    {result.timestamps.map((ts, idx) => (
                      <div key={idx} className="timestamp-result-item">
                        <span className="timestamp-time">{ts.time}</span>
                        <span className="timestamp-text">{ts.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recording */}
              {result.recordingUrl && (
                <div className="result-section">
                  <h4><i className="ri-vidicon-line"></i> Interview Recording</h4>
                  <div className="recording-player">
                    <video 
                      controls 
                      preload="metadata"
                      className="recording-video"
                    >
                      <source src={result.recordingUrl} type="video/webm" />
                      Your browser does not support the video tag.
                    </video>
                    <a 
                      href={result.recordingUrl} 
                      download 
                      className="recording-download"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <i className="ri-download-line"></i>
                      Download Recording
                    </a>
                  </div>
                </div>
              )}

              {/* General Notes */}
              {result.notes && (
                <div className="result-section">
                  <h4><i className="ri-sticky-note-line"></i> Notes</h4>
                  <div className="notes-content">
                    {result.notes}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewResultModal;
