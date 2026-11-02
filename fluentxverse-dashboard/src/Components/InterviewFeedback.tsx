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
  const [interview, setInterview] = useState<Awaited<ReturnType<typeof interviewApi.getRoom>> | null>(null);
  const [scores, setScores] = useState({ grammar: 3, fluency: 3, pronunciation: 3, vocabulary: 3, professionalism: 3 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInterview = async () => {
      try {
        const found = await interviewApi.getRoom(interviewId);
        if (found) {
          setInterview(found);
          setDecision(found.result === 'pass' || found.result === 'fail' ? found.result : null);
          setNotes(found.notes || '');
          if (found.rubricScores) setScores(found.rubricScores);
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
      if (!interview) throw Error('Interview not loaded');
      await interviewApi.saveResult(interviewId, interview.tutorId, {
        result: decision, notes, rubricScores: scores,
        timestamps: interview.timestamps || [], expectedReviewedAt: interview.reviewedAt || null,
      });
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to submit feedback');
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
              <span>{interview.tutorName}</span>
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
                aria-label="Pass" aria-pressed={decision === 'pass'}
                onClick={() => setDecision('pass')}
                disabled={submitting}
              >
                <i className="ri-check-line"></i>
                Pass
              </button>
              <button
                className={`decision-btn fail ${decision === 'fail' ? 'selected' : ''}`}
                aria-label="Fail" aria-pressed={decision === 'fail'}
                onClick={() => setDecision('fail')}
                disabled={submitting}
              >
                <i className="ri-close-line"></i>
                Fail
              </button>
            </div>
          </div>

          <div className="feedback-section">
            <label className="section-label">Evaluation scores</label>
            {Object.entries(scores).map(([key, score]) => <label className="info-row" key={key}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
              <select aria-label={`${key} score`} value={score} disabled={submitting} onChange={event => setScores(current => ({ ...current, [key]: Number(event.currentTarget.value) }))}>
                {[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}
              </select>
            </label>)}
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
              maxLength={2000}
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
            aria-label={submitting ? 'Submitting feedback' : 'Submit Feedback'}
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
