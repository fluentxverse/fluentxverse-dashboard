import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { testingApi, type TestingItem, type TestingProgress } from '../api/testing.api';
import './TestingPage.css';

type Filter = 'all' | 'pending' | 'passed' | 'gated';

function CheckRow({ item, canEdit, onSaved }: { item: TestingItem; canEdit: boolean; onSaved: (next: Partial<TestingItem>) => void }) {
  const [notes, setNotes] = useState(item.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dirty = notes !== item.notes;
  const savingRef = useRef(false);
  const previousNotes = useRef(item.notes);
  useEffect(() => {
    const previous = previousNotes.current;
    setNotes(current => current === previous ? item.notes : current);
    previousNotes.current = item.notes;
  }, [item.notes]);
  const save = async (completed: boolean) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true); setError('');
    try {
      const next = await testingApi.update(item, completed, notes);
      if (typeof next.notes === 'string') setNotes(next.notes);
      onSaved(next);
    }
    catch (err: any) { setError(err.message); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <article className={`testing-row ${item.completed ? 'passed' : ''}`}>
    <div className="testing-row-heading">
      <input type="checkbox" id={`test-${item.id}`} aria-label={`Passed: ${item.title}`} checked={item.completed}
        disabled={!canEdit || saving || Boolean(item.gate)} onChange={event => void save(event.currentTarget.checked)} />
      <label htmlFor={`test-${item.id}`}>{item.title}</label>
      <span className={`testing-status ${item.gate ? 'gated' : item.completed ? 'passed' : 'pending'}`}>{saving ? 'Saving...' : item.gate ? 'Gated' : item.completed ? 'Passed' : 'Not tested'}</span>
    </div>
    <div className="testing-row-body">
      {item.gate && <p className="testing-gate"><i className="ri-lock-line" aria-hidden="true" />{item.gate}</p>}
      <p>{item.steps}</p>
      <p className="testing-expected"><strong>Expected:</strong> {item.expected}</p>
      <details>
        <summary>{dirty ? 'Unsaved notes' : item.notes ? 'Test notes recorded' : 'Test notes'}</summary>
        <label className="testing-notes-label" htmlFor={`notes-${item.id}`}>Result, issue reference, and test environment</label>
        <textarea id={`notes-${item.id}`} rows={3} maxLength={2000} value={notes} disabled={!canEdit || saving}
          placeholder="Use test account aliases and issue IDs. Do not include passwords, tokens, or private recording links."
          onInput={event => setNotes(event.currentTarget.value)} />
        {canEdit && <button type="button" className="testing-save" disabled={saving || !dirty} onClick={() => void save(item.completed)}><i className="ri-save-line" aria-hidden="true" />Save notes</button>}
      </details>
      {item.updatedAt && <small>Updated by {item.updatedBy || 'a teammate'} | {new Date(item.updatedAt).toLocaleString()}</small>}
      {error && <p className="testing-error" role="alert">{error}</p>}
    </div>
  </article>;
}

export default function TestingPage() {
  const [progress, setProgress] = useState<TestingProgress | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const alive = useRef(true);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true; setLoading(true);
    try {
      const data = await testingApi.list();
      if (alive.current) {
        setProgress(current => current?.runId === data.runId ? { ...data, items: data.items.map(item => {
          const previous = current.items.find(check => check.id === item.id);
          return previous && previous.revision > item.revision ? previous : item;
        }) } : data);
        setError('');
      }
    }
    catch (err: any) { if (alive.current) setError(err.response?.data?.error || err.message || 'Could not load testing progress.'); }
    finally { inFlight.current = false; if (alive.current) setLoading(false); }
  }, []);
  useEffect(() => {
    alive.current = true; document.title = 'Testing | FluentXVerse Admin'; void load();
    // Shared progress refreshes without replacing unsaved row notes.
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    const interval = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { alive.current = false; clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [load]);
  const items = progress?.items || [];
  const runnable = items.filter(item => !item.gate);
  const passed = runnable.filter(item => item.completed).length;
  const counts = { all: items.length, pending: runnable.length - passed, passed, gated: items.filter(item => item.gate).length };
  const search = query.trim().toLowerCase();
  const visible = items.filter(item => (filter === 'all' || (filter === 'gated' ? item.gate : filter === 'passed' ? item.completed : !item.completed && !item.gate)) &&
    (!search || `${item.title} ${item.category} ${item.steps} ${item.expected} ${item.notes}`.toLowerCase().includes(search)));
  const categories = [...new Set(visible.map(item => item.category))];
  const saveItem = (id: string, next: Partial<TestingItem>) => setProgress(current => current ? {
    ...current, items: current.items.map(item => item.id === id && (next.revision ?? 0) >= item.revision ? { ...item, ...next } : item),
  } : current);
  return <div className="testing-page">
    <header className="testing-header">
      <div><h1>Testing</h1><p>MVP pilot checklist</p></div>
      <button type="button" className="testing-refresh" title="Refresh team progress" aria-label="Refresh team progress" disabled={loading} onClick={() => void load()}><i className="ri-refresh-line" aria-hidden="true" /></button>
    </header>
    {progress && <div className="testing-progress" aria-live="polite"><strong>{passed} / {runnable.length} passed</strong><progress value={passed} max={runnable.length} aria-label="Pilot tests passed" /><span>{counts.gated} gated</span></div>}
    {progress && !progress.canEdit && <p className="testing-access">Read-only | Operations permission is required to record results.</p>}
    <div className="testing-toolbar">
      <div className="testing-filters" role="group" aria-label="Test status">
        {(['all', 'pending', 'passed', 'gated'] as Filter[]).map(value => <button type="button" key={value} aria-pressed={filter === value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{value === 'all' ? 'All' : value === 'pending' ? 'Not tested' : value === 'passed' ? 'Passed' : 'Gated'} <span>{counts[value]}</span></button>)}
      </div>
      <label className="testing-search"><i className="ri-search-line" aria-hidden="true" /><input type="search" aria-label="Search tests" placeholder="Search tests" value={query} onInput={event => setQuery(event.currentTarget.value)} /></label>
    </div>
    {error && <div className="testing-error" role="alert">{error} <button type="button" onClick={() => void load()} disabled={loading}>Retry</button></div>}
    {!progress ? <p className="testing-empty" role="status">{loading ? 'Loading team checklist...' : 'Testing progress is unavailable.'}</p> : visible.length === 0 ? <p className="testing-empty">No tests in this view.</p> : categories.map(category => <section key={category} className="testing-section" aria-label={category}>
      <h2>{category}<span>{items.filter(item => item.category === category && item.completed).length} / {items.filter(item => item.category === category && !item.gate).length} passed</span></h2>
      {visible.filter(item => item.category === category).map(item => <CheckRow key={`${progress.runId}:${item.id}`} item={item} canEdit={progress.canEdit} onSaved={next => saveItem(item.id, next)} />)}
    </section>)}
  </div>;
}
