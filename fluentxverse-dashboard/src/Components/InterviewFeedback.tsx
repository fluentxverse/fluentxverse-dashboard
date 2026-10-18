import { useState, useEffect } from 'preact/hooks';
import { interviewApi, type PendingInterview } from '@api/interview.api';
import './InterviewFeedback.css';

interface InterviewFeedbackProps {
  interviewId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const InterviewFeedback = ({ interviewId, onClose, onSuccess }: InterviewFeedbackProps) => {
  const [decision, setDecision] = useState<'pass' | 'fail' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interview, setInterview] = useState<PendingInterview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInterview = async () => {
      try {
        const pending = await interviewApi.getPendingInterviews();
        const found = pending.find(p => p.id === interviewId);
        if (found) {
          setInterview(found);
        } else {
          setError('Interview not found');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load interview');
      } finally {
        setLoading(false);
      }
    };
    loadInterview();
  }, [interviewId]);

  const handleSubmit = async () => {
    if (!decision) {
      setError('Please select a decision');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // TODO: Create POST /interview/feedback endpoint
      // For now, we'll just close the modal
      const feedback = {
        interviewId,
        decision,
        notes,
        feedback_submitted_at: new Date().toISOString()
      };
      // await interviewApi.submitFeedback(feedback);
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-dialog interview-feedback-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">Loading...</div>
        </div>
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-dialog interview-feedback-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-body">
            <p>Interview not found</p>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog interview-feedback-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><i className="ri-clipboard-check-line"></i> Interview Feedback</h2>
          <button className="modal-close" onClick={onClose}>
            <i className="ri-close-line"></i>
          </button>
        </div>
        
        <div className="modal-body">
          <div className="feedback-info">
            <div className="info-row">
              <label>Candidate:</label>
              <span>{interview.tutorName} ({interview.tutorEmail})</span>
            </div>
            <div className="info-row">
              <label>Interview Date:</label>
              <span>{interview.date} at {interview.time}</span>
            </div>
          </div>

          <div className="feedback-section">
            <label className="section-label">Decision <span className="required">*</span></label>
            <div className="decision-buttons">
              <button
                className={`decision-btn pass ${decision === 'pass' ? 'selected' : ''}`}
                onClick={() => setDecision('pass')}
                disabled={submitting}
              >
                <i className="ri-check-line"></i>
                Pass
              </button>
              <button
                className={`decision-btn fail ${decision === 'fail' ? 'selected' : ''}`}
                onClick={() => setDecision('fail')}
                disabled={submitting}
              >
                <i className="ri-close-line"></i>
                Fail
              </button>
            </div>
          </div>

          <div className="feedback-section">
            <label className="section-label">Notes</label>
            <textarea
              className="feedback-notes"
              placeholder="Add any notes or feedback for the candidate..."
              value={notes}
              onChange={(e) => setNotes((e.target as any).value)}
              disabled={submitting}
              rows={6}
            />
            <p className="char-count">{notes.length} / 2000</p>
          </div>

          {error && (
            <div className="error-message">
              <i className="ri-error-warning-line"></i>
              {error}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={submitting || !decision}
          >
            {submitting ? (
              <span><i className="ri-loader-4-line ri-spin"></i> Submitting...</span>
            ) : (
              <span><i className="ri-send-plane-line"></i> Submit Feedback</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewFeedback;
