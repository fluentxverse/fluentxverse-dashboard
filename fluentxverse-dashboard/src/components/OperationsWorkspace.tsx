import type { ComponentChildren } from 'preact';
import { accountLink, dateText, labelText, lessonLink } from './OperationsShared';

export function OpsIcon({ name }: { name: string }) {
  return <i className={`ri-${name}-line`} aria-hidden="true" />;
}

export function OpsBadge({ value, children, tone }: { value?: string; children?: ComponentChildren; tone?: 'info' | 'success' | 'warning' | 'danger' | 'neutral' }) {
  const key = String(value || 'unknown').toLowerCase().replaceAll(' ', '_');
  const defaultTone = ['resolved', 'completed', 'submitted', 'present', 'open', 'both_attended', 'connected', 'attended'].includes(key) ? 'success'
    : ['urgent', 'absent', 'cancelled', 'overdue', 'failed', 'tutor_absent', 'student_absent'].includes(key) ? 'danger'
    : ['high', 'under_review', 'review', 'pending', 'draft', 'changes_pending', 'unverified', 'awaiting_verification'].includes(key) ? 'warning'
    : ['confirmed', 'upcoming', 'in_progress', 'ongoing', 'support', 'qa', 'operations', 'finance'].includes(key) ? 'info' : 'neutral';
  const text = labelText(value || 'Not recorded').replace(/\b\w/g, letter => letter.toUpperCase());
  return <span className={`ops-badge ops-badge-${tone || defaultTone}`}>{children || text}</span>;
}

export function OpsEmpty({ title, icon = 'inbox' }: { title: string; icon?: string }) {
  return <div className="ops-empty"><OpsIcon name={icon} /><p>{title}</p></div>;
}

export function OpsSection({ title, count, children, aside }: { title: string; count?: number; children: ComponentChildren; aside?: ComponentChildren }) {
  return <section className="ops-section"><div className="ops-section-heading"><h3>{title}{count !== undefined && <span className="ops-count">{count}</span>}</h3>{aside}</div>{children}</section>;
}

export function OpsPerson({ person, role }: { person?: any; role: string }) {
  const name = person?.name || 'Not recorded';
  const initials = name.split(/\s+/).slice(0, 2).map((word: string) => word[0]).join('').toUpperCase();
  return <div className="ops-person"><span className={`ops-person-initials ops-person-${role}`} aria-hidden="true">{initials}</span><div>
    {person?.id ? <a href={accountLink(role, person.id)}>{name}</a> : <strong>{name}</strong>}
    {person?.email && <span>{person.email}</span>}
  </div></div>;
}

export function OpsLessonTable({ rows = [], empty = 'No lessons in this date range.' }: { rows?: any[]; empty?: string }) {
  if (!rows.length) return <OpsEmpty title={empty} icon="calendar-check" />;
  return <div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Lessons table"><table className="ops-table">
    <thead><tr><th scope="col">Date & time (PHT)</th><th scope="col">Tutor</th><th scope="col">Student</th><th scope="col">Outcome</th><th scope="col">Notes</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
    <tbody>{rows.map(b => <tr key={b.bookingId}>
      <td><span className="ops-date">{dateText(b.slotDateTime || b.startsAt)}</span><a className="ops-id" href={lessonLink(b.bookingId)}>{b.bookingId}</a></td>
      <td><OpsPerson role="tutor" person={b.tutor || { name: b.tutorId }} /></td>
      <td><OpsPerson role="student" person={b.student || { name: b.studentName || b.studentId }} /></td>
      <td><OpsBadge value={b.outcome} /></td><td><OpsBadge value={b.notes?.notesStatus || b.notesStatus} /></td>
      <td><a className="ops-icon-button" href={lessonLink(b.bookingId)} title="Open lesson" aria-label="Open lesson"><OpsIcon name="arrow-right" /></a></td>
    </tr>)}</tbody>
  </table></div>;
}

export function OpsPager({ page, total, pages, onPage, unit = 'records' }: { page: number; total: number; pages: number; onPage: (value: number) => void; unit?: string }) {
  const count = Math.max(1, pages || 1);
  return <nav className="ops-pager" aria-label="Results pagination"><span>{total} {unit}</span><div>
    <button type="button" className="ops-icon-button" title="Previous page" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><OpsIcon name="arrow-left-s" /></button>
    <span>Page {page} of {count}</span>
    <button type="button" className="ops-icon-button" title="Next page" aria-label="Next page" disabled={page >= count} onClick={() => onPage(page + 1)}><OpsIcon name="arrow-right-s" /></button>
  </div></nav>;
}

export function OpsStats({ items }: { items: { label: string; value: string | number; tone?: string }[] }) {
  return <dl className={`ops-stats ops-stats-${items.length}`}>{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd className={item.tone ? `ops-number-${item.tone}` : ''}>{item.value}</dd></div>)}</dl>;
}

export function OpsPerformance({ data }: { data: any }) {
  return <><OpsStats items={[
    { label: 'Bookable slots', value: data.slots?.bookable ?? 0 }, { label: 'Booked slots', value: data.slots?.booked ?? 0 },
    { label: 'Attended lessons', value: data.lessons?.attended ?? 0 }, { label: 'Teaching hours', value: data.lessons?.teachingHours ?? 0 },
    { label: 'Cancellation ratio', value: data.cancellation?.rate == null ? '-' : `${data.cancellation.rate}%` },
    { label: 'Reliability', value: data.reliability?.score == null ? '-' : `${data.reliability.score}%` },
    { label: 'Notes overdue', value: data.notes?.overdue ?? 0, tone: 'danger' }, { label: 'Rating', value: data.rating?.average ?? '-' },
  ]} /><OpsSection title="Attendance"><OpsStats items={[
    { label: 'Present', value: data.attendance?.present ?? 0, tone: 'success' }, { label: 'Absent', value: data.attendance?.absent ?? 0, tone: 'danger' }, { label: 'Unverified', value: data.attendance?.unverified ?? 0 },
  ]} /></OpsSection><OpsSection title="Lessons"><OpsLessonTable rows={data.recentLessons || []} /></OpsSection></>;
}

export function OpsLiveLessons({ rows }: { rows: any[] }) {
  if (!rows.length) return <OpsEmpty title="No live lessons in this date range." icon="live" />;
  return <div className="ops-live-list">{rows.map(b => <article className="ops-live-item" key={b.bookingId}>
    <div className="ops-live-top"><div><a className="ops-item-title" href={lessonLink(b.bookingId)}>{b.tutor?.name || 'Tutor'} / {b.student?.name || 'Student'}</a><span className="ops-meta">{dateText(b.slotDateTime)} · {b.durationMinutes || 25} min</span></div>
      <OpsBadge value={/missing|disconnected/i.test(b.alert || '') ? 'urgent' : b.alert === 'In progress' ? 'in_progress' : 'pending'}>{b.alert || 'Status unavailable'}</OpsBadge>
    </div><div className="ops-presence-grid">{['tutor', 'student'].map(role => {
      const peers = (b.presence || []).filter((p: any) => p.role === role);
      return <div key={role}><span className="ops-label">{role === 'tutor' ? 'Tutor' : 'Student'}</span><strong><span className={`ops-presence-dot ${peers.length ? 'is-present' : ''}`} />{peers.length ? 'Room present' : 'Not in room'}</strong><span className="ops-meta">Call {peers.some((p: any) => p.callState === 'connected') ? 'reported connected' : peers.length ? 'unconfirmed' : 'offline'}</span></div>;
    })}</div><a className="ops-text-link" href={lessonLink(b.bookingId)}>Open lesson <OpsIcon name="arrow-right" /></a>
  </article>)}</div>;
}

export function OpsFeedback({ data, rows }: { data: any; rows: any[] }) {
  return <><OpsStats items={[{ label: 'Responses', value: data.total || 0 }, { label: 'Response rate', value: data.responseRate == null ? '-' : `${data.responseRate}%` }, { label: 'Average rating', value: data.average ?? '-' }]} />
    <div className="ops-feedback-topics">{[['What went well', 'positive'], ['What could improve', 'improvement']].map(([title, key]) => {
      const topics = (data.topics || []).filter((point: any) => key !== 'positive' || point.positiveEnabled);
      return <OpsSection key={key} title={title}>{topics.length ? topics.map((point: any) => <div className="ops-topic" key={point.id || point.label}><span>{point.label}</span><progress value={point[key] || 0} max={data.total || 1} aria-label={`${point.label}: ${title}`} /><strong>{point[key] || 0}</strong></div>) : <OpsEmpty title="No responses recorded." icon="chat-check" />}</OpsSection>;
    })}</div><OpsSection title="QA comments" count={(data.rows || []).filter((row: any) => row.comment).length}>
      {rows.length ? <div className="ops-comments">{rows.map((row: any) => <article key={row.bookingId}><div><a href={lessonLink(row.bookingId)}>{row.tutor?.name || 'Tutor'}</a><span className="ops-meta">{dateText(row.startsAt)}</span>{row.rating != null && <span className="ops-rating"><OpsIcon name="star" />{row.rating} / 5</span>}</div><p>{row.comment}</p></article>)}</div> : <OpsEmpty title="No QA comments in this date range." icon="chat-1" />}
    </OpsSection></>;
}
