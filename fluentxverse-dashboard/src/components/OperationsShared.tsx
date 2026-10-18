import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { operations, attendanceOperation, operationError } from '../api/operations.api';
export const dateText = (v: any) => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' PHT' : '-';
export const labelText = (v: any) => String(v ?? '-').replaceAll('_', ' ');
export const lessonLink = (id: string) => `/lesson-operations/${encodeURIComponent(id)}`;
export const accountLink = (role: string, id: string) => `/operations/people/${role}/${encodeURIComponent(id)}`;
export function IconButton({ icon, title, onClick, disabled = false }: any) { return <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}><i aria-hidden="true" className={`ri-${icon}-line`} /></button>; }
export function LessonTable({ rows = [] }: { rows: any[] }) {
  return <div className="operations-table-wrap"><table><thead><tr><th>Date & time (PHT)</th><th>Tutor</th><th>Student</th><th>Outcome</th><th>Notes</th><th /></tr></thead><tbody>{rows.map(b => <tr key={b.bookingId}><td>{dateText(b.slotDateTime || b.startsAt)}</td><td>{b.tutor?.id ? <a href={accountLink('tutor', b.tutor.id)}>{b.tutor.name}</a> : b.tutorId || '-'}</td><td>{b.student?.id ? <a href={accountLink('student', b.student.id)}>{b.student.name}</a> : b.studentName || b.studentId || '-'}</td><td>{labelText(b.outcome)}</td><td>{labelText(b.notes?.notesStatus || b.notesStatus)}</td><td><a className="operations-icon-link" aria-label="Open lesson" title="Open lesson" href={lessonLink(b.bookingId)}><i aria-hidden="true" className="ri-arrow-right-line" /></a></td></tr>)}</tbody></table>{!rows.length && <p className="operations-empty">No lessons found.</p>}</div>;
}
export function History({ rows = [] }: { rows: any[] }) {
  return <div>{rows.map((a, i) => <article key={a.id || i} className="operations-audit"><strong>{labelText(a.action || a.subject || 'Attendance change')}</strong><span>{dateText(a.createdAt || a.at)} · {a.actorId || a.reviewedBy || ''}</span><p>{a.reason || a.comment || a.resolution || `${labelText(a.previousStatus)} to ${labelText(a.status)}`}</p>{a.beforeJson && <details><summary>Before & after</summary><pre>{a.beforeJson}</pre><pre>{a.afterJson}</pre></details>}</article>)}{!rows.length && <p>No history recorded.</p>}</div>;
}
export function Metrics({ data }: any) {
  if (!data) return null;
  const values = [['Bookable slots', data.slots?.bookable], ['Booked slots', data.slots?.booked], ['Attended lessons', data.lessons?.attended], ['Teaching hours', data.lessons?.teachingHours], ['Cancellation ratio', data.cancellation?.rate == null ? '-' : `${data.cancellation.rate}%`], ['Reliability', data.reliability?.score == null ? '-' : `${data.reliability.score}%`], ['Notes overdue', data.notes?.overdue], ['Rating', data.rating?.average ?? '-']];
  return <><div className="operations-metrics">{values.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value ?? 0}</strong></article>)}</div><h2>Attendance</h2><p>Present: {data.attendance?.present ?? 0} · Absent: {data.attendance?.absent ?? 0} · Unverified: {data.attendance?.unverified ?? 0}</p><h2>Lessons</h2><LessonTable rows={data.recentLessons || []} /></>;
}
export function Fields({ value }: any) {
  if (value == null) return <p>None recorded.</p>;
  if (Array.isArray(value)) return <div>{value.length ? value.map((v, i) => <article key={i} className="operations-record"><Fields value={v} /></article>) : <p>None recorded.</p>}</div>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  return <dl className="operations-fields">{Object.entries(value).filter(([key]) => !['snapshotJson', 'clientUpdatedAt', 'sessionId', 'id'].includes(key)).map(([key, v]) => <div key={key}><dt>{labelText(key.replace(/([A-Z])/g, ' $1'))}</dt><dd>{typeof v === 'object' && v ? <Fields value={v} /> : String(v ?? '-')}</dd></div>)}</dl>;
}
export function OperationsAction({ action, onClose, onSaved, permissions = [] }: any) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [hours, setHours] = useState(24), [subject, setSubject] = useState('tutor'), [status, setStatus] = useState(action.report?.status || 'under_review');
  const [resolution, setResolution] = useState(action.report?.resolution || ''), [refund, setRefund] = useState('');
  const [assignee, setAssignee] = useState(action.report?.assigneeId || ''), [priority, setPriority] = useState(action.report?.priority || 'normal');
  const [caps, setCaps] = useState<string[]>(action.admin?.permissions || []), [admins, setAdmins] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]), [slot, setSlot] = useState(''), [day, setDay] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }));
  const [transactions, setTransactions] = useState<any[]>([]);
  const [preview, setPreview] = useState<any>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    if (action.kind === 'revoke') operations(`/penalties/${encodeURIComponent(action.id)}/preview`).then(setPreview).catch(e => setError(operationError(e)));
    if (action.kind === 'case') operations('/admins').then(setAdmins).catch(e => setError(operationError(e)));
    if (action.kind === 'review' && permissions.includes('finance')) operations(`/lessons/${encodeURIComponent(action.report.bookingId)}`).then(d => setTransactions(d.transactions.filter((t: any) => t.status === 'completed' && ['cancellation', 'refund'].includes(t.type)))).catch(e => setError(operationError(e)));
  }, []);
  useEffect(() => {
    if (action.kind !== 'reschedule') return;
    setSlot(''); operations(`/slots?from=${day}&to=${day}&tutorId=${encodeURIComponent(action.tutorId)}`).then(d => setSlots(d.filter((s: any) => s.status === 'open' && Date.parse(s.startsAt) > Date.now() + 5 * 60000))).catch(e => setError(operationError(e)));
  }, [day]);
  const submit = async (e: Event) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError(''); const id = encodeURIComponent(action.id || '');
    try {
      if (action.kind === 'attendance') await attendanceOperation(`/${id}`, 'put', { status: action.status, subject, reason });
      else if (action.kind === 'restore') await attendanceOperation(`/${id}/restore/${encodeURIComponent(action.auditId)}`, 'post', { reason });
      else if (action.kind === 'review') await operations(`/reports/${action.report.source}/${encodeURIComponent(action.report.id)}/review`, 'put', { status, resolution, ticketTransactionId: refund || undefined });
      else if (action.kind === 'case') await operations(`/reports/${action.report.source}/${encodeURIComponent(action.report.id)}`, 'patch', { assigneeId: assignee, priority, comment: reason });
      else if (action.kind === 'permissions') await operations(`/admins/${encodeURIComponent(action.admin.id)}/permissions`, 'patch', { permissions: caps, reason });
      else if (action.kind === 'revoke') await operations(`/penalties/${id}/revoke`, 'post', { reason });
      else if (action.kind === 'unblock') await operations(`/tutors/${id}/unblock`, 'post', { reason });
      else if (action.kind === 'cancel' || action.kind === 'reschedule') await operations(`/lessons/${id}/schedule`, 'post', { action: action.kind, reason, targetSlotId: slot || undefined });
      else await operations(`/lessons/${id}/${action.kind}`, 'post', { reason, hours });
      await onSaved(); onClose();
    } catch (e) { setError(operationError(e)); } finally { setBusy(false); }
  };
  const titles: Record<string, string> = { cancel: 'Cancel lesson', reschedule: 'Reschedule lesson', reopen: 'Reopen lesson notes', refund: 'Approve ticket refund', attendance: `Correct attendance to ${action.status}`, restore: 'Recover archived notes', revoke: 'Revoke penalty', unblock: 'Remove booking restriction', review: 'Review issue report', case: 'Case assignment & internal update', permissions: 'Admin permissions' };
  return createPortal(<dialog className="operations-dialog lesson-operations" ref={ref} onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><form onSubmit={submit}><header><h2>{titles[action.kind]}</h2><IconButton icon="close" title="Close" disabled={busy} onClick={onClose} /></header>
    {error && <p role="alert" className="operations-error">{error}</p>}
    {preview && <p>Reliability: {preview.current ?? '-'}% to {preview.proposed ?? '-'}% · Cancellation ratio: {preview.cancellationBefore ?? '-'}% to {preview.cancellationAfter ?? '-'}%</p>}
    {action.kind === 'attendance' && <><label>Subject<select value={subject} onChange={e => setSubject(e.currentTarget.value)}><option value="tutor">Tutor</option><option value="student">Student</option></select></label>{action.status === 'absent' && subject === 'student' && <p className="operations-error">Lesson notes will be archived and removed from student and tutor views.</p>}</>}
    {action.kind === 'reopen' && <label>Editing window (hours)<input type="number" min="1" max="168" value={hours} onInput={e => setHours(Number(e.currentTarget.value))} required /></label>}
    {action.kind === 'unblock' && <>{action.name && <p><strong>{action.name}</strong></p>}<p>The automatic booking restriction is waived for seven days. Attendance penalties remain in the ledger. Account suspensions are not changed.</p></>}
    {action.kind === 'refund' && <p>Returns the lesson ticket through the existing refund process. Uncertain transfers are held for review.</p>}
    {action.kind === 'cancel' && <p>The classroom will close for both participants. Ticket refunds follow the cancellation policy.</p>}
    {action.kind === 'reschedule' && <><label>New date (PHT)<input type="date" required value={day} onInput={e => setDay(e.currentTarget.value)} /></label><label>Available slot<select required value={slot} onChange={e => setSlot(e.currentTarget.value)}><option value="">Select a slot</option>{slots.map(s => <option value={s.slotId}>{dateText(s.startsAt)} · {s.durationMinutes || 25} min</option>)}</select></label>{!slots.length && <p>No bookable slots on this date.</p>}</>}
    {action.kind === 'review' && <><p>{action.report.tutorIssueLabel || action.report.studentIssueLabel || action.report.reason}</p><p>{action.report.details}</p><label>Status<select value={status} onChange={e => setStatus(e.currentTarget.value)}><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="resolved">Resolved</option></select></label><label>Resolution visible to reporter<textarea value={resolution} onInput={e => setResolution(e.currentTarget.value)} required={status === 'resolved'} maxLength={2000} /></label>{permissions.includes('finance') && <label>Completed refund<select value={refund} onChange={e => setRefund(e.currentTarget.value)}><option value="">No refund linked</option>{transactions.map(t => <option value={t.id}>{dateText(t.completedAt || t.createdAt)} · {t.id}</option>)}</select></label>}</>}
    {action.kind === 'case' && <><label>Assigned admin<select value={assignee} onChange={e => setAssignee(e.currentTarget.value)}><option value="">Unassigned</option>{admins.map(a => <option value={a.id}>{a.name || a.username}</option>)}</select></label><label>Priority<select value={priority} onChange={e => setPriority(e.currentTarget.value)}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><History rows={action.report.internalHistory || []} /></>}
    {action.kind === 'permissions' && <fieldset><legend>{action.admin.name}</legend>{['support', 'qa', 'operations', 'finance'].map(cap => <label className="operations-check"><input type="checkbox" checked={caps.includes(cap)} onChange={e => setCaps(e.currentTarget.checked ? [...caps, cap] : caps.filter(c => c !== cap))} />{labelText(cap)}</label>)}</fieldset>}
    {action.kind !== 'review' && <label>{action.kind === 'case' ? 'Internal update' : 'Reason'}<textarea required maxLength={action.kind === 'case' ? 2000 : 1000} value={reason} onInput={e => setReason(e.currentTarget.value)} /></label>}
    <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="operations-primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Confirm'}</button></footer>
  </form></dialog>, document.body);
}
