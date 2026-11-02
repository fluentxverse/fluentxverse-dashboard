import { useEffect, useRef, useState } from 'preact/hooks';
import { operations, operationError } from '../api/operations.api';
import { dateText, labelText, lessonLink, History, OperationsAction } from '../components/OperationsShared';
import { OpsBadge, OpsEmpty, OpsFeedback, OpsIcon, OpsLessonTable, OpsLiveLessons, OpsPager, OpsPerformance, OpsSection, OpsStats } from '../components/OperationsWorkspace';
import { AdminArt } from '../components/AdminArt';
import { adminApi } from '../api/admin.api';
import PrivateDisputeEvidence from '../components/PrivateDisputeEvidence';
import LessonOutcomeAssessment from '../components/LessonOutcomeAssessment';
import { completionDecisionLabels, lessonOutcomeLabels, type CompletionDecision, type LessonOutcomeCode } from '../../../shared/lessonOutcome';
import './LessonOperationsPage.css';
import './LessonOperationsWorkspace.css';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const views = [
  { key: 'live', label: 'Live', title: 'Live lessons', icon: 'live', group: 'Lessons' },
  { key: 'lessons', label: 'Lessons', title: 'All lessons', icon: 'video-chat', group: 'Lessons' },
  { key: 'schedule', label: 'Schedule', title: 'Schedule', icon: 'calendar-2', group: 'Lessons' },
  { key: 'notes', label: 'Notes', title: 'Outstanding notes', icon: 'file-text', group: 'Lessons', permission: 'support' },
  { key: 'issues', label: 'Issues', title: 'Issue reports', icon: 'flag', group: 'Lessons', permission: 'support' },
  { key: 'feedback', label: 'Feedback', title: 'Student feedback', icon: 'chat-check', group: 'Insights', permission: 'qa' },
  { key: 'performance', label: 'Performance', title: 'Tutor performance', icon: 'bar-chart-box', group: 'Insights' },
  { key: 'payments', label: 'Payments', title: 'Payments', icon: 'bank-card', group: 'Administration', permission: 'finance' },
  { key: 'audit', label: 'Audit', title: 'Audit log', icon: 'history', group: 'Administration' },
  { key: 'permissions', label: 'Permissions', title: 'Admin permissions', icon: 'shield-keyhole', group: 'Administration' },
];
const groups = ['Lessons', 'Insights', 'Administration'];
const serverPaged = ['live', 'lessons', 'notes', 'schedule', 'performance'];
const dateViews = ['live', 'lessons', 'notes', 'schedule', 'feedback', 'payments'];
const searchViews = ['live', 'lessons', 'notes', 'schedule', 'issues', 'audit'];
const clientPageSize = 10;
const overdue = (report: any) => report.status !== 'resolved' && Date.parse(report.dueAt) < Date.now();

export default function LessonOperationsPage() {
  const requested = new URLSearchParams(window.location.search).get('tab') || (window.location.pathname === '/payments' ? 'payments' : 'live');
  const [tab, setTab] = useState(views.some(view => view.key === requested) ? requested : 'live');
  const [access, setAccess] = useState<any>(null), [accessError, setAccessError] = useState(''), [accessReload, setAccessReload] = useState(0);
  const [data, setData] = useState<any>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [notice, setNotice] = useState(''), [action, setAction] = useState<any>(null), [reload, setReload] = useState(0);
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState({ from: today(), to: today(), search: '', status: 'all', page: 1, tutor: '', period: 'month', month: today().slice(0, 7) });
  const [tutors, setTutors] = useState<any[]>([]), [tutorsLoading, setTutorsLoading] = useState(false), [tutorsError, setTutorsError] = useState('');
  const request = useRef(0);
  const allowed = views.filter(view => access && (view.key === 'permissions' ? access.role === 'superadmin' : !view.permission || access.permissions?.includes(view.permission)));
  const current = views.find(view => view.key === tab)!;
  const permitted = allowed.some(view => view.key === tab);
  const queryKey = JSON.stringify({
    from: dateViews.includes(tab) ? filters.from : '', to: dateViews.includes(tab) ? filters.to : '',
    search: ['live', 'lessons', 'notes', 'schedule', 'audit'].includes(tab) ? filters.search : '',
    page: serverPaged.includes(tab) ? filters.page : 1,
    tutor: tab === 'performance' ? filters.tutor : '', period: tab === 'performance' ? filters.period : '', month: tab === 'performance' ? filters.month : '',
  });

  useEffect(() => {
    let active = true; setAccessError('');
    operations('/access').then(value => { if (active) setAccess(value); }).catch(e => { if (active) setAccessError(operationError(e)); });
    return () => { active = false; };
  }, [accessReload]);

  useEffect(() => {
    if (!access || tab !== 'performance') return;
    let active = true; setTutorsLoading(true); setTutorsError('');
    adminApi.getTutors({ limit: 1000 }).then((value: any) => { if (active) setTutors(value.tutors || value.data?.tutors || []); })
      .catch(e => { if (active) setTutorsError(operationError(e)); }).finally(() => { if (active) setTutorsLoading(false); });
    return () => { active = false; };
  }, [access, tab, reload]);

  const load = async (background = false) => {
    if (!access) return;
    const token = ++request.current;
    if (!background) { setLoading(true); setData(null); }
    setError('');
    try {
      if (!permitted) throw new Error('You do not have access to this view.');
      if (dateViews.includes(tab) && (!filters.from || !filters.to || filters.from > filters.to)) throw new Error('Choose a valid date range. The end date must be on or after the start date.');
      const q = new URLSearchParams({ from: filters.from, to: filters.to, search: filters.search, page: String(filters.page) });
      let value;
      if (tab === 'issues') value = await operations('/reports');
      else if (tab === 'permissions') value = await operations('/admins');
      else if (tab === 'audit') value = await operations(`/audit?subjectId=${encodeURIComponent(filters.search)}`);
      else if (tab === 'performance') value = filters.tutor ? await operations(`/performance/${encodeURIComponent(filters.tutor)}?period=${filters.period}&month=${filters.month}&page=${filters.page}`) : null;
      else if (tab === 'feedback') value = await operations(`/surveys?${q}`);
      else if (tab === 'payments') value = await operations(`/payments?${q}`);
      else if (tab === 'schedule') {
        const lessons = operations(`/lessons?${q}`), slots = operations(`/slots?${q}`);
        const values = await Promise.all([lessons, slots]); value = { lessons: values[0], slots: values[1] };
      } else value = await operations(`/lessons?${q}&view=${tab === 'lessons' ? 'all' : tab}`);
      if (request.current === token) setData(value);
    } catch (e) { if (request.current === token) setError(operationError(e)); }
    finally { if (request.current === token) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { request.current++; }; }, [access, tab, queryKey, reload]);
  useEffect(() => {
    if (!access || tab !== 'live' || !permitted) return;
    const timer = setInterval(() => void load(true), 15000);
    return () => clearInterval(timer);
  }, [access, tab, queryKey]);

  const changeTab = (key: string) => {
    if (key === tab) return;
    request.current++; setLoading(true); setData(null); setError(''); setNotice(''); setSearchDraft('');
    setFilters(value => ({ ...value, page: 1, search: '', status: 'all' })); setTab(key);
    const url = new URL(window.location.href); url.searchParams.set('tab', key); history.replaceState(null, '', url.pathname + url.search);
  };
  const update = (value: Partial<typeof filters>) => setFilters(previous => ({ ...previous, ...value, page: value.page || 1 }));
  const changePage = (value: number) => update({ page: value });
  const allReports: any[] = tab === 'issues' && Array.isArray(data) ? data : [];
  const reports = allReports.filter(report => (filters.status === 'all' || (filters.status === 'overdue' ? overdue(report) : report.status === filters.status))
    && (!filters.search || `${report.bookingId} ${report.tutorIssueLabel || ''} ${report.studentIssueLabel || ''} ${report.reason} ${report.details} ${report.assigneeId || ''}`.toLowerCase().includes(filters.search.toLowerCase())));
  const comments = tab === 'feedback' ? (data?.rows || []).filter((row: any) => row.comment) : [];
  const transactions = tab === 'payments' ? data?.rows || [] : [];
  const clientRows: any[] = tab === 'issues' ? reports : tab === 'feedback' ? comments : tab === 'payments' ? transactions : Array.isArray(data) ? data : [];
  const localPages = Math.max(1, Math.ceil(clientRows.length / clientPageSize));
  const currentPage = serverPaged.includes(tab) ? filters.page : Math.min(filters.page, localPages);
  const visibleRows = clientRows.slice((currentPage - 1) * clientPageSize, currentPage * clientPageSize);
  const clientPager = (unit: string) => <OpsPager page={currentPage} total={clientRows.length} pages={localPages} onPage={changePage} unit={unit} />;
  const serverPager = (value: any) => <OpsPager page={filters.page} total={value?.total || 0} pages={value?.totalPages || 1} onPage={changePage} unit="lessons" />;

  return <div className="lesson-operations ops-workspace">
    <div className="ops-workspace-heading"><div className="ops-title"><AdminArt name="schedule" /><div><h1>Lesson Operations</h1><span className="ops-meta"><OpsIcon name="global" /> Philippine Time (PHT)</span></div></div>
      <button type="button" className="ops-refresh" title="Refresh" aria-label="Refresh" disabled={loading && !!access} onClick={() => access ? setReload(value => value + 1) : setAccessReload(value => value + 1)}><OpsIcon name="refresh" /><span>Refresh</span></button>
    </div>
    {access && <>
      <nav className="ops-view-navigation" aria-label="Operations views">{groups.map(group => {
        const options = allowed.filter(view => view.group === group);
        return options.length > 0 && <div className="ops-nav-group" key={group}><span className="ops-nav-label">{group}</span><div>{options.map(view => <button type="button" key={view.key} aria-pressed={tab === view.key} onClick={() => changeTab(view.key)}><OpsIcon name={view.icon} />{view.label}</button>)}</div></div>;
      })}</nav>
      <label className="ops-mobile-view">View<select value={tab} onChange={e => changeTab(e.currentTarget.value)}>{!permitted && <option value={tab} disabled>Unavailable view</option>}{groups.map(group => <optgroup label={group} key={group}>{allowed.filter(view => view.group === group).map(view => <option key={view.key} value={view.key}>{view.title}</option>)}</optgroup>)}</select></label>
    </>}
    {notice && <div className="ops-message ops-message-success" role="status"><OpsIcon name="checkbox-circle" />{notice}</div>}
    {(accessError || error || tutorsError) && <div className="ops-message ops-message-error" role="alert"><OpsIcon name="error-warning" /><span>{accessError || error || tutorsError}</span><button type="button" onClick={() => access ? setReload(value => value + 1) : setAccessReload(value => value + 1)}>Retry</button></div>}
    {access && <div className="ops-view-heading"><h2>{current.title}</h2>{tab === 'live' && <span className="ops-live-indicator"><span />Live · 15s refresh</span>}{filters.search && <span className="ops-applied-filter">{tab === 'audit' ? 'Subject' : 'Search'}: {filters.search}<button type="button" aria-label="Clear search" title="Clear search" onClick={() => { setSearchDraft(''); update({ search: '' }); }}><OpsIcon name="close" /></button></span>}</div>}
    {access && permitted && (dateViews.includes(tab) || searchViews.includes(tab) || tab === 'performance') && <form className="ops-filter-bar" onSubmit={e => { e.preventDefault(); update({ search: searchDraft.trim() }); if (searchDraft.trim() === filters.search && currentPage === 1) setReload(value => value + 1); }}>
      {searchViews.includes(tab) && <label className="ops-search-field">{tab === 'audit' ? 'Subject ID' : 'Search'}<span><OpsIcon name="search" /><input aria-label={tab === 'audit' ? 'Subject ID' : 'Search'} value={searchDraft} placeholder={tab === 'audit' ? 'Booking, account, or subject ID' : tab === 'issues' ? 'Report, lesson ID, or assignee' : 'Tutor, student, or lesson ID'} onInput={e => setSearchDraft(e.currentTarget.value)} /><button type="submit" title="Search" aria-label="Search"><OpsIcon name="arrow-right" /></button></span></label>}
      {dateViews.includes(tab) && <><label>From<input type="date" required value={filters.from} onInput={e => update({ from: e.currentTarget.value })} /></label><label>To<input type="date" required value={filters.to} onInput={e => update({ to: e.currentTarget.value })} /></label><button type="button" className="ops-today" onClick={() => update({ from: today(), to: today() })}><OpsIcon name="calendar-event" />Today</button></>}
      {tab === 'issues' && <label>Status<select aria-label="Status" value={filters.status} onChange={e => update({ status: e.currentTarget.value })}>{[['all', 'All statuses'], ['submitted', 'Submitted'], ['under_review', 'Under review'], ['resolved', 'Resolved'], ['overdue', 'Overdue']].map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>}
      {tab === 'performance' && <><label className="ops-tutor-filter">Tutor<select aria-label="Tutor" disabled={tutorsLoading} value={filters.tutor} onChange={e => update({ tutor: e.currentTarget.value })}><option value="">{tutorsLoading ? 'Loading tutors...' : 'Select a tutor'}</option>{tutors.map(t => <option key={t.id} value={t.id}>{t.name || `${t.givenName || t.firstName || ''} ${t.familyName || t.lastName || ''}`.trim() || t.email}{t.email ? ` · ${t.email}` : ''}</option>)}</select></label><label>Period<select value={filters.period} onChange={e => update({ period: e.currentTarget.value })}><option value="month">Monthly</option><option value="30days">Last 30 days</option><option value="all">All time</option></select></label>{filters.period === 'month' && <label>Month<input type="month" required value={filters.month} onInput={e => update({ month: e.currentTarget.value })} /></label>}</>}
    </form>}
    <div className="ops-results" aria-busy={loading && !accessError}>
      {(!access || loading) && !accessError ? <div className="ops-loading" role="status"><OpsIcon name="loader-4" />Loading {access ? current.title.toLowerCase() : 'operations'}...</div> : !error && !accessError && permitted && <>
        {['lessons', 'notes'].includes(tab) && <><OpsLessonTable rows={data?.rows || []} empty={tab === 'notes' ? 'No outstanding lesson notes in this date range.' : undefined} />{serverPager(data)}</>}
        {tab === 'live' && <><OpsLiveLessons rows={data?.rows || []} />{serverPager(data)}</>}
        {tab === 'schedule' && data && <><OpsSection title="Booked lessons" count={data.lessons.total}><OpsLessonTable rows={data.lessons.rows} />{serverPager(data.lessons)}</OpsSection><OpsSection title="Published slots" count={data.slots.length}>
          {data.slots.length ? <div className="ops-schedule-days">{Array.from(new Set<string>(data.slots.map((slot: any) => slot.slotDate))).map(day => <article key={day}><h4>{new Date(`${day}T12:00:00+08:00`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric' })}</h4>{data.slots.filter((slot: any) => slot.slotDate === day).map((slot: any) => <div className="ops-published-slot" key={slot.slotId}><strong>{slot.slotTime}</strong><span>{slot.tutor?.name || 'Tutor'}</span><OpsBadge value={slot.status} /></div>)}</article>)}</div> : <OpsEmpty title="No published slots in this date range." icon="calendar-2" />}
        </OpsSection></>}
        {tab === 'issues' && <>
          <OpsStats items={[{ label: 'Open reports', value: allReports.filter(report => report.status !== 'resolved').length }, { label: 'Under review', value: allReports.filter(report => report.status === 'under_review').length }, { label: 'Overdue', value: allReports.filter(overdue).length, tone: 'danger' }, { label: 'Resolved', value: allReports.filter(report => report.status === 'resolved').length, tone: 'success' }]} />
          <OpsSection title="Reports" count={reports.length}><div className="ops-report-list">{visibleRows.map(report => <article className="ops-report-item" key={`${report.source}:${report.id}`}>
            <div className="ops-report-heading"><div><a className="ops-item-title" href={lessonLink(report.bookingId)}>{report.tutorIssueLabel || report.studentIssueLabel || report.reason}</a><span className="ops-meta">{report.source === 'tutor' ? 'Tutor report' : 'Student report'} · {dateText(report.createdAt)}</span></div><div className="ops-report-badges"><OpsBadge value={report.status} tone={report.status === 'submitted' ? 'info' : undefined} /><OpsBadge value={report.priority || 'normal'} /></div></div>
            <div className="ops-report-meta"><a className="ops-id" href={lessonLink(report.bookingId)}><OpsIcon name="video-chat" />{report.bookingId}</a><span title={report.assigneeId || ''}><OpsIcon name="user" />{report.assigneeName || (report.assigneeId ? 'Assigned' : 'Unassigned')}</span>{overdue(report) && <span className="ops-overdue"><OpsIcon name="time" />Review overdue</span>}</div>
            {report.details && <p className="ops-report-excerpt">{report.details}</p>}
            <div className="ops-report-actions"><button type="button" onClick={() => setAction({ kind: 'case', report })}><OpsIcon name="user-settings" />Assign & update</button><button type="button" className="ops-primary-action" onClick={() => setAction({ kind: 'review', report })}><OpsIcon name="edit" />Review</button></div>
            <details className="ops-report-details"><summary>Details & evidence <OpsIcon name="arrow-down-s" /></summary><div className="ops-report-details-body">
              <div><h4>Report details</h4><p>{report.details || 'No additional details.'}</p>{report.resolution && <><h4>Resolution</h4><p>{report.resolution}</p></>}</div>
              <details className="ops-case-history"><summary>Case history ({(report.internalHistory || []).length + (report.reviewHistory || []).length})</summary><History rows={[...(report.internalHistory || []), ...(report.reviewHistory || [])]} /></details>
              <PrivateDisputeEvidence source={report.source} reportId={report.id} />
              <div className="ops-workspace-outcome"><p>Completion: {completionDecisionLabels[(report.completionDecision || 'not_assessed') as CompletionDecision] || 'Not assessed'}{report.completionOutcome && ` · ${lessonOutcomeLabels[report.completionOutcome as LessonOutcomeCode] || report.completionOutcome}`}</p><LessonOutcomeAssessment key={`${report.id}:${report.reviewedAt}`} bookingId={report.bookingId} /></div>
            </div></details>
          </article>)}</div>{!reports.length && <OpsEmpty title="No reports match these filters." icon="flag" />}</OpsSection>{clientPager('reports')}
        </>}
        {tab === 'feedback' && data && <><OpsFeedback data={data} rows={visibleRows} />{clientPager('comments')}</>}
        {tab === 'performance' && (data ? <><OpsPerformance data={data} />{serverPager({ total: data.lessons?.total || 0, totalPages: data.totalPages || 1 })}</> : <OpsEmpty title="Select a tutor to view their performance." icon="bar-chart-box" />)}
        {tab === 'payments' && data && <><OpsSection title="Refund queue" count={data.review.length} aside={<span className="ops-meta">All pending refunds</span>}>
          {data.review.length ? <div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Refund queue"><table className="ops-table"><thead><tr><th scope="col">Lesson</th><th scope="col">Status</th><th scope="col">Reason</th><th scope="col">Action</th></tr></thead><tbody>{data.review.map((booking: any) => <tr key={booking.bookingId}><td><a className="ops-id" href={lessonLink(booking.bookingId)}>{booking.bookingId}</a></td><td><OpsBadge value={booking.refundStatus} /></td><td>{booking.refundReviewReason || booking.refundError || '-'}</td><td>{booking.refundStatus !== 'review' ? <button type="button" onClick={() => setAction({ kind: 'refund', id: booking.bookingId })}><OpsIcon name="refund-2" />Approve refund</button> : <span className="ops-meta">Held for review</span>}</td></tr>)}</tbody></table></div> : <OpsEmpty title="No refunds pending." icon="refund-2" />}
        </OpsSection><OpsSection title="Ticket transactions" count={transactions.length}>
          {visibleRows.length ? <div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Ticket transactions"><table className="ops-table"><thead><tr><th scope="col">Date (PHT)</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Transaction</th><th scope="col">Lesson</th></tr></thead><tbody>{visibleRows.map((transaction: any) => <tr key={transaction.id}><td>{dateText(transaction.createdAt)}</td><td>{labelText(transaction.type)}</td><td><OpsBadge value={transaction.status} /></td><td className="ops-monospace">{transaction.id}</td><td>{transaction.bookingId ? <a className="ops-id" href={lessonLink(transaction.bookingId)}>{transaction.bookingId}</a> : '-'}</td></tr>)}</tbody></table></div> : <OpsEmpty title="No transactions in this date range." icon="bank-card" />}
        </OpsSection>{clientPager('transactions')}</>}
        {tab === 'audit' && <><div className="ops-history">{visibleRows.length ? <History rows={visibleRows} /> : <OpsEmpty title="No audit events match this subject." icon="history" />}</div>{clientPager('events')}</>}
        {tab === 'permissions' && <>{visibleRows.length ? <div className="ops-table-scroll" tabIndex={0} role="region" aria-label="Admin permissions"><table className="ops-table"><thead><tr><th scope="col">Administrator</th><th scope="col">Role</th><th scope="col">Permissions</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleRows.map(admin => <tr key={admin.id}><td><strong>{admin.name || admin.username}</strong></td><td><OpsBadge value={admin.role} /></td><td><div className="ops-permission-tags">{admin.permissions?.length ? admin.permissions.map((permission: string) => <OpsBadge key={permission} value={permission} />) : <span className="ops-meta">No access</span>}</div></td><td>{admin.role !== 'superadmin' ? <button type="button" onClick={() => setAction({ kind: 'permissions', admin })}><OpsIcon name="shield-keyhole" />Edit permissions</button> : <span className="ops-meta">Full access</span>}</td></tr>)}</tbody></table></div> : <OpsEmpty title="No administrators found." icon="shield-user" />}{clientPager('administrators')}</>}
      </>}
    </div>
    {action && <OperationsAction key={`${action.kind}:${action.id || action.report?.id || action.admin?.id}`} action={action} permissions={access?.permissions} onClose={() => setAction(null)} onSaved={async () => { setNotice('Changes saved.'); setReload(value => value + 1); }} />}
  </div>;
}
