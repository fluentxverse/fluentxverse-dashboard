import { useEffect, useRef, useState } from 'preact/hooks';
import { operations, operationError } from '../api/operations.api';
import { dateText, labelText, lessonLink, Fields, History, LessonTable, Metrics, OperationsAction, IconButton } from './OperationsShared';
import '../pages/LessonOperationsPage.css';
import { TutorCompensation } from './TutorCompensation';
export function OperationsAccountDetail({ role, id, initialTab = 'profile', onClose }: {
  role: string; id: string; initialTab?: string; onClose?: () => void;
}) {
  const [data, setData] = useState<any>(null), [access, setAccess] = useState<any>(null), [tab, setTab] = useState(initialTab);
  const [error, setError] = useState(''), [history, setHistory] = useState<any[]>([]), [action, setAction] = useState<any>(null), [loading, setLoading] = useState(false);
  const tabBar = useRef<HTMLElement>(null);
  const requestVersion = useRef(0);
  const load = async () => {
    const version = ++requestVersion.current;
    setLoading(true); setData(null); setError('');
    try {
      const nextAccess = await operations('/access');
      const nextData = await operations(`/people/${role}/${encodeURIComponent(id)}`);
      const nextHistory = await operations(`/audit?subjectId=${encodeURIComponent(id)}`);
      if (version !== requestVersion.current) return;
      setAccess(nextAccess); setData(nextData); setHistory(nextHistory);
    } catch (e) { if (version === requestVersion.current) setError(operationError(e)); }
    finally { if (version === requestVersion.current) setLoading(false); }
  };
  useEffect(() => { void load(); return () => { requestVersion.current++; }; }, [role, id]);
  useEffect(() => { if (access && tab === 'compensation' && (role !== 'tutor' || !access.permissions.includes('finance'))) setTab('profile'); }, [access, role, tab]);
  useEffect(() => { tabBar.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [tab, Boolean(data)]);
  const tabs = ['profile', 'lessons', 'schedule', 'penalties', 'issues', role === 'tutor' ? 'performance' : 'progress', 'compensation', 'transactions', 'history'].filter(t => (role === 'tutor' || t !== 'penalties') && (t !== 'transactions' || access?.permissions.includes('finance')) && (t !== 'compensation' || (role === 'tutor' && access?.permissions.includes('finance'))));
  const tabKey = (event: KeyboardEvent, current: string) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(current);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next]);
    tabBar.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };
  return <div className={`lesson-operations${onClose ? ' account-detail' : ''}`}>
    {!onClose && <a href={role === 'tutor' ? '/tutors' : '/students'}><i aria-hidden="true" className="ri-arrow-left-line" />{role === 'tutor' ? 'Tutors' : 'Students'}</a>}
    <header><div><h1 id="account-detail-title">{data?.person.name || 'Account Detail'}</h1>{onClose && data?.person.email && <p className="operations-muted account-email">{data.person.email}</p>}</div><div className="account-header-actions"><IconButton icon="refresh" title="Refresh account" disabled={loading} onClick={load} />{onClose && <IconButton icon="close" title="Close tutor details" onClick={onClose} />}</div></header>{error && <p className="operations-error" role="alert">{error}</p>}{loading && <p role="status">Loading account...</p>}
    {data && <><nav className="operations-tabs" ref={tabBar} role="tablist" aria-label="Account sections">{tabs.map(t => <button key={t} id={`account-tab-${t}`} role="tab" aria-selected={tab === t} aria-controls={`account-panel-${t}`} tabIndex={tab === t ? 0 : -1} className={tab === t ? 'active' : ''} onKeyDown={event => tabKey(event, t)} onClick={() => setTab(t)}>{labelText(t)}</button>)}</nav>
      <div className="account-panel" id={`account-panel-${tab}`} role="tabpanel" aria-labelledby={`account-tab-${tab}`} tabIndex={0}>
      {tab === 'profile' && <><Fields value={data.person} />{data.person.isBlocked && role === 'tutor' && access?.permissions.includes('operations') && <button onClick={() => setAction({ kind: 'unblock', id })}><i aria-hidden="true" className="ri-lock-unlock-line" />Remove booking restriction</button>}</>}
      {tab === 'lessons' && <LessonTable rows={data.lessons} />}
      {tab === 'schedule' && <LessonTable rows={data.lessons.filter((b: any) => b.status === 'confirmed' && Date.parse(b.slotDateTime) > Date.now())} />}
      {tab === 'penalties' && <>{data.penalties.map((p: any) => <article className="operations-record"><Fields value={p} />{access?.permissions.includes('operations') && !p.revokedAt && p.status !== 'voided' && p.penaltyCode !== '601' && <button onClick={() => setAction({ kind: 'revoke', id: p.penaltyId })}>Revoke penalty</button>}</article>)}{!data.penalties.length && <p>No penalties.</p>}</>}
      {tab === 'issues' && <>{data.reports.map((r: any) => <article className="operations-record"><a href={lessonLink(r.bookingId)}>{r.tutorIssueLabel || r.studentIssueLabel || r.reason}</a><p>{dateText(r.createdAt)} · {labelText(r.status)}</p><p>{r.details}</p></article>)}{!data.reports.length && <p>No reports.</p>}</>}
      {tab === 'performance' && <Metrics data={data.performance} />}
      {tab === 'progress' && <Fields value={data.progress} />}
      {tab === 'transactions' && <Fields value={data.transactions} />}
      {tab === 'compensation' && role === 'tutor' && access?.permissions.includes('finance') && <TutorCompensation key={id} tutorId={id || ''} />}
      {tab === 'history' && <History rows={history} />}
      </div>
    </>}
    {action && <OperationsAction action={action} permissions={access?.permissions} onClose={() => setAction(null)} onSaved={load} />}
  </div>;
}
