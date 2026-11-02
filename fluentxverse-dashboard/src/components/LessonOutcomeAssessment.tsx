import { useEffect, useState } from 'preact/hooks';
import type { LessonOutcomeAssessment as Assessment } from '../../../shared/lessonOutcome';
import { lessonOutcomeLabels } from '../../../shared/lessonOutcome';
import { operations, operationError } from '../api/operations.api';
import { dateText, IconButton } from './OperationsShared';

const stateLabels: Record<Assessment['state'], string> = {
  eligible: 'Eligible for proof generation', ineligible: 'Not eligible', review_required: 'Support review required',
  waiting_for_lesson_end: 'Lesson not ended', waiting_for_reports: 'Awaiting student reporting deadline',
};
const reasonLabels: Record<string, string> = {
  reports_require_explicit_approval: 'Resolve all reports and record an explicit completion decision.',
  completion_rejected: 'Support rejected completion.', tutor_marked_absent: 'Tutor attendance is marked absent.',
  active_ta301: 'An uncleared TA-301 tutor-absence penalty blocks completion.',
  ta301_attendance_conflict: 'Tutor attendance says present, but TA-301 remains. Correct the penalty and attendance records before requesting a proof.',
  tutor_attendance_unconfirmed: 'Tutor attendance has not been confirmed.',
  insufficient_tutor_presence: 'Insufficient recorded tutor presence.',
  arrival_or_waiting_requirement_not_met: 'Recorded arrival or waiting time does not meet the policy.',
  student_attendance_conflicts_with_presence: 'Student attendance conflicts with classroom records.',
  insufficient_student_outcome_evidence: 'Insufficient evidence to establish the student outcome.',
  review_outcome_conflicts_with_evidence: 'The approved outcome does not match the recorded evidence.',
  invalid_lesson_timing: 'Lesson timing requires review.', unsupported_booking_status: 'Booking status requires review.',
};
export default function LessonOutcomeAssessment({ bookingId }: { bookingId: string }) {
  const [data, setData] = useState<Assessment | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [requesting, setRequesting] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true); setError(''); setData(null);
    operations(`/lessons/${encodeURIComponent(bookingId)}/outcome`).then(value => { if (active) setData(value); })
      .catch(e => { if (active) setError(operationError(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [bookingId, revision]);
  return <section aria-label="Lesson outcome eligibility" className="operations-outcome-assessment">
    <header><h3>Lesson outcome</h3><IconButton icon="refresh" title="Refresh lesson outcome" disabled={loading} onClick={() => setRevision(r => r + 1)} /></header>
    {loading && <p role="status">Checking eligibility...</p>}{error && <p role="alert">{error}</p>}
    {data && <><p role="status">{stateLabels[data.state]}</p>{data.outcome && <p>{lessonOutcomeLabels[data.outcome]}</p>}
      {reasonLabels[data.reason] && <p>{reasonLabels[data.reason]}</p>}
      <p>Reporting deadline: {dateText(data.reportingClosesAt)}</p>
      <p>{data.proofRequest?.phase === 'awaiting_prover' ? 'Generation requested; awaiting prover setup. No proof generated.'
        : data.proofRequest?.phase === 'needs_reassessment' ? 'Previous request requires reassessment. No proof generated.' : 'Proof not generated'}</p>
      <button type="button" disabled={loading || requesting || data.state !== 'eligible' || data.proofRequest?.phase === 'awaiting_prover'} onClick={async () => {
        setRequesting(true); setError('');
        try { await operations(`/lessons/${encodeURIComponent(bookingId)}/outcome-proof`, 'post', {}); setRevision(r => r + 1); }
        catch (e) { setError(operationError(e)); }
        finally { setRequesting(false); }
      }}><i aria-hidden="true" className="ri-shield-check-line" />{requesting ? 'Requesting...' : 'Generate completion proof'}</button>
    </>}
  </section>;
}
