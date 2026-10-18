import { useEffect, useRef, useState } from 'preact/hooks';
import { operations, operationError } from '../api/operations.api';
import { dateText, labelText, lessonLink, LessonTable, History, Metrics, OperationsAction, IconButton } from '../components/OperationsShared';
import { adminApi } from '../api/admin.api';
import './LessonOperationsPage.css';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
export default function LessonOperationsPage() {
  const initial = new URLSearchParams(window.location.search).get('tab') || (window.location.pathname === '/payments' ? 'payments' : 'live');
  const [access, setAccess] = useState<any>(null), [tab, setTab] = useState(initial), [data, setData] = useState<any>(null);
  const [from, setFrom] = useState(today()), [to, setTo] = useState(today()), [search, setSearch] = useState('');
  const [page, setPage] = useState(1), [status, setStatus] = useState('all'), [tutor, setTutor] = useState(''), [tutors, setTutors] = useState<any[]>([]);
  const [period, setPeriod] = useState('month'), [month, setMonth] = useState(today().slice(0, 7));
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(false), [action, setAction] = useState<any>(null);
  const request = useRef(0);
  useEffect(() => { operations('/access').then(setAccess).catch(e => setError(operationError(e))); }, []);
  useEffect(() => { if (tab === 'performance') adminApi.getTutors({ limit: 1000 }).then((r: any) => setTutors(r.tutors || r.data?.tutors || [])).catch(e => setError(operationError(e))); }, [tab]);
  const tabs = [['live', 'Live'], ['lessons', 'Lessons'], ['schedule', 'Schedule'], ['notes', 'Notes'], ['issues', 'Issues'], ['feedback', 'Feedback'], ['performance', 'Performance'], ['payments', 'Payments'], ['audit', 'Audit'], ['permissions', 'Permissions']].filter(([key]) => {
    if (!access) return false;
    return key === 'permissions' ? access.role === 'superadmin' : ['issues', 'notes'].includes(key) ? access.permissions.includes('support') : key === 'feedback' ? access.permissions.includes('qa') : key === 'payments' ? access.permissions.includes('finance') : true;
  });
  const load = async (background = false) => {
    if (!access) return; const token = ++request.current;
    if (!background) setLoading(true); setError('');
    const q = new URLSearchParams({ from, to, search, page: String(page) });
    try {
      if (!tabs.some(([key]) => key === tab)) throw new Error('You do not have access to this view.');
      let value;
      if (tab === 'issues') value = await operations('/reports');
      else if (tab === 'permissions') value = await operations('/admins');
      else if (tab === 'audit') value = await operations(`/audit?subjectId=${encodeURIComponent(search)}`);
      else if (tab === 'performance') value = tutor ? await operations(`/performance/${encodeURIComponent(tutor)}?period=${period}&month=${month}&page=${page}`) : null;
      else if (tab === 'feedback') value = await operations(`/surveys?${q}`);
      else if (tab === 'payments') value = await operations(`/payments?${q}`);
      else if (tab === 'schedule') value = { lessons: await operations(`/lessons?${q}`), slots: await operations(`/slots?${q}`) };
      else value = await operations(`/lessons?${q}&view=${tab === 'lessons' ? 'all' : tab}`);
      if (request.current === token) setData(value);
    } catch (e) { if (request.current === token) setError(operationError(e)); }
    finally { if (request.current === token) setLoading(false); }
  };
  useEffect(() => { setData(null); void load(); return () => { request.current++; }; }, [access, tab, from, to, page, tutor, period, month]);
  useEffect(() => { if (tab !== 'live') return; const timer = setInterval(() => void load(true), 15000); return () => clearInterval(timer); }, [access, tab, from, to, page, search]);
  const changeTab = (key: string) => { setData(null); setTab(key); setPage(1); setNotice(''); history.replaceState(null, '', `${window.location.pathname}?tab=${key}`); };
  const reports = Array.isArray(data) && tab === 'issues' ? data.filter(r => (status === 'all' || (status === 'overdue' ? r.status !== 'resolved' && Date.parse(r.dueAt) < Date.now() : r.status === status)) && (!search || `${r.bookingId} ${r.reason} ${r.details}`.toLowerCase().includes(search.toLowerCase()))) : [];
  return <div className="lesson-operations"><header><div><h1>Lesson Operations</h1><span className="operations-muted">Philippine Time (PHT)</span></div><IconButton icon="refresh" title="Refresh" disabled={loading} onClick={() => load()} /></header>
    <nav className="operations-tabs" aria-label="Operations views">{tabs.map(([key, name]) => <button type="button" className={tab === key ? 'active' : ''} onClick={() => changeTab(key)}>{name}</button>)}</nav>
    {error && <p className="operations-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form className="operations-filters" onSubmit={e => { e.preventDefault(); setPage(1); void load(); }}>
      {!['audit', 'permissions', 'performance', 'issues'].includes(tab) && <><label>From<input type="date" required value={from} onInput={e => { setFrom(e.currentTarget.value); setPage(1); }} /></label><label>To<input type="date" required value={to} onInput={e => { setTo(e.currentTarget.value); setPage(1); }} /></label></>}
      {['lessons', 'live', 'schedule', 'notes', 'issues', 'audit'].includes(tab) && <label className="operations-search">{tab === 'audit' ? 'Subject ID' : 'Search'}<input value={search} onInput={e => setSearch(e.currentTarget.value)} /><button type="submit" title="Search" aria-label="Search"><i aria-hidden="true" className="ri-search-line" /></button></label>}
      {tab === 'issues' && <label>Status<select value={status} onChange={e => setStatus(e.currentTarget.value)}>{['all', 'submitted', 'under_review', 'resolved', 'overdue'].map(s => <option value={s}>{labelText(s)}</option>)}</select></label>}
      {tab === 'performance' && <><label>Tutor<select aria-label="Tutor" value={tutor} onChange={e => { setTutor(e.currentTarget.value); setPage(1); }}><option value="">Select a tutor</option>{tutors.map(t => <option value={t.id}>{t.name || `${t.givenName || t.firstName || ''} ${t.familyName || t.lastName || ''}`} · {t.email}</option>)}</select></label><label>Period<select aria-label="Period" value={period} onChange={e => { setPeriod(e.currentTarget.value); setPage(1); }}><option value="month">Monthly</option><option value="30days">Last 30 days</option><option value="all">All time</option></select></label>{period === 'month' && <label>Month<input type="month" value={month} onInput={e => { setMonth(e.currentTarget.value); setPage(1); }} /></label>}</>}
    </form>
    {loading && <p role="status">Loading...</p>}
    {!loading && data && <>
      {['lessons', 'notes'].includes(tab) && <><LessonTable rows={data.rows} /><Pagination data={data} page={page} setPage={setPage} /></>}
      {tab === 'live' && <div className="operations-live-list">{data.rows.map((b: any) => <article className="operations-live" key={b.bookingId}><header><a href={lessonLink(b.bookingId)}><strong>{b.tutor.name} / {b.student.name}</strong></a><span className={b.alert?.includes('missing') ? 'operations-error' : ''}>{b.alert}</span></header><p>{dateText(b.slotDateTime)} · {b.durationMinutes || 25} min</p><div className="operations-presence">{['tutor', 'student'].map(role => { const peers = b.presence?.filter((p: any) => p.role === role) || []; return <span><strong>{labelText(role)}:</strong> {peers.length ? 'Room present' : 'Not in room'} · Call {peers.some((p: any) => p.callState === 'connected') ? 'reported connected' : peers.length ? 'unconfirmed' : 'offline'}</span>; })}</div></article>)}{!data.rows.length && <p>No live lessons.</p>}<Pagination data={data} page={page} setPage={setPage} /></div>}
      {tab === 'schedule' && <><h2>Booked lessons</h2><LessonTable rows={data.lessons.rows} /><Pagination data={data.lessons} page={page} setPage={setPage} /><h2>Published slots</h2><div className="operations-calendar">{Array.from(new Set<string>(data.slots.map((s: any) => s.slotDate))).map(day => <article key={day}><h3>{day}</h3>{data.slots.filter((s: any) => s.slotDate === day).map((s: any) => <div className="operations-slot"><span>{s.slotTime} · {s.tutor.name}</span><strong>{labelText(s.status)}</strong></div>)}</article>)}</div>{!data.slots.length && <p>No slots in this period.</p>}</>}
      {tab === 'issues' && <div className="operations-report-list">{reports.map((r: any) => <article key={`${r.source}:${r.id}`}><div><a href={lessonLink(r.bookingId)}><strong>{r.tutorIssueLabel || r.studentIssueLabel || r.reason}</strong></a><span>{labelText(r.source)} · {dateText(r.createdAt)}</span><span>{labelText(r.priority)} priority · {r.assigneeId || 'Unassigned'}</span>{r.status !== 'resolved' && Date.parse(r.dueAt) < Date.now() && <span className="operations-error">Review overdue</span>}<details><summary>History</summary><History rows={[...(r.internalHistory || []), ...(r.reviewHistory || [])]} /></details></div><span>{labelText(r.status)}</span><button type="button" onClick={() => setAction({ kind: 'case', report: r })}><i aria-hidden="true" className="ri-user-settings-line" />Assign & update</button><button type="button" onClick={() => setAction({ kind: 'review', report: r })}><i aria-hidden="true" className="ri-edit-line" />Review</button></article>)}{!reports.length && <p>No reports in this view.</p>}</div>}
      {tab === 'feedback' && <><div className="operations-metrics"><article><span>Responses</span><strong>{data.total}</strong></article><article><span>Response rate</span><strong>{data.responseRate == null ? '-' : `${data.responseRate}%`}</strong></article><article><span>Average rating</span><strong>{data.average ?? '-'}</strong></article></div><FeedbackPoints data={data} /><h2>QA comments</h2>{data.rows.filter((r: any) => r.comment).map((r: any) => <article className="operations-record"><a href={lessonLink(r.bookingId)}>{r.tutor.name} · {dateText(r.startsAt)}</a><p>{r.comment}</p></article>)}</>}
      {tab === 'performance' && <><Metrics data={data} /><Pagination data={{ total: data.lessons?.total || 0, totalPages: data.totalPages || 1 }} page={page} setPage={setPage} /></>}
      {tab === 'payments' && <><h2>Refund queue</h2><div className="operations-table-wrap"><table><thead><tr><th>Lesson</th><th>Status</th><th>Reason</th><th /></tr></thead><tbody>{data.review.map((b: any) => <tr><td><a href={lessonLink(b.bookingId)}>{b.bookingId}</a></td><td>{b.refundStatus}</td><td>{b.refundReviewReason || b.refundError || '-'}</td><td>{b.refundStatus !== 'review' && <button type="button" onClick={() => setAction({ kind: 'refund', id: b.bookingId })}>Approve refund</button>}</td></tr>)}</tbody></table></div><h2>Ticket transactions</h2><div className="operations-table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Status</th><th>Transaction</th><th>Lesson</th></tr></thead><tbody>{data.rows.map((t: any) => <tr><td>{dateText(t.createdAt)}</td><td>{labelText(t.type)}</td><td>{labelText(t.status)}</td><td>{t.id}</td><td>{t.bookingId && <a href={lessonLink(t.bookingId)}>{t.bookingId}</a>}</td></tr>)}</tbody></table>{!data.rows.length && <p>No transactions.</p>}</div></>}
      {tab === 'audit' && <History rows={data} />}
      {tab === 'permissions' && <div className="operations-report-list">{data.map((a: any) => <article><div><strong>{a.name || a.username}</strong><span>{a.role} · {a.permissions.join(', ') || 'No access'}</span></div>{a.role !== 'superadmin' && <button onClick={() => setAction({ kind: 'permissions', admin: a })}><i aria-hidden="true" className="ri-shield-keyhole-line" />Edit permissions</button>}</article>)}</div>}
    </>}
    {tab === 'performance' && !tutor && !loading && <p>Select a tutor.</p>}
    {action && <OperationsAction key={`${action.kind}:${action.id || action.report?.id || action.admin?.id}`} action={action} permissions={access?.permissions} onClose={() => setAction(null)} onSaved={async () => { setNotice('Changes saved.'); await load(); }} />}
  </div>;
}
function Pagination({ data, page, setPage }: any) { return <footer className="operations-pagination"><span>{data.total} lessons · Page {page} of {Math.max(1, data.totalPages)}</span><IconButton icon="arrow-left" title="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} /><IconButton icon="arrow-right" title="Next page" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} /></footer>; }
function FeedbackPoints({ data }: any) { return <div className="operations-feedback-grid">{[['What went well', 'positive'], ['What could improve', 'improvement']].map(([title, key]) => <section><h2>{title}</h2>{(data.topics || []).filter((p: any) => key !== 'positive' || p.positiveEnabled).map((p: any) => <div className="operations-feedback-point"><span>{p.label}</span><progress max={data.total || 1} value={p[key] || 0} /><strong>{p[key] || 0}</strong></div>)}</section>)}</div>; }
