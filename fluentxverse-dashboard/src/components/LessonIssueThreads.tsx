import { useEffect, useState } from 'preact/hooks';
import { apiClient } from '../api/apiClient';
import { issueThreadStatus, type LessonIssueThread } from '../../../shared/lessonIssueThread';
import '../../../shared/ui/lesson-issue-threads.css';
const imageUrl = (threadId: string, id: string) => (apiClient.defaults.baseURL || '').replace(/\/$/,'') + '/inbox/lesson-issues/' + encodeURIComponent(threadId) + '/images/' + id + '?admin=true';

export default function LessonIssueThreads() {
  const [threads, setThreads] = useState<LessonIssueThread[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try { const r = await apiClient.get('/inbox/lesson-issues/?admin=true', { signal: controller.signal }); if (!controller.signal.aborted) { setThreads(r.data.data); setError(''); } }
      catch { if (!controller.signal.aborted) setError('Could not load lesson conversations. Please retry.'); }
    };
    void load(); const timer = setInterval(() => void load(), 60000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [revision]);
  const date = (value: string) => new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) + ' PHT';
  if (!threads.length && !error) return null;
  return <section className="lesson-issue-threads" aria-label="Lesson issue conversations">
    <header><h2>Lesson issue conversations</h2><button type="button" disabled={busy} onClick={() => setRevision(v => v + 1)}><i className="ri-refresh-line" aria-hidden="true"/>Refresh</button></header>
    {error && <p role="alert">{error}</p>}
    {!threads.length && !error && <p>No lesson issue conversations.</p>}
    {threads.map(thread => <details key={thread.id}><summary>{date(thread.startsAt)}: {issueThreadStatus[thread.state] || thread.state}</summary>
      <p>Tutor reference: {thread.tutorId} / Lesson reference: {thread.bookingId}</p>
      <a href={'/lesson-operations/' + encodeURIComponent(thread.bookingId)}>Open lesson</a>
      {thread.decisionReason && <p className="issue-thread-body"><strong>Staff decision: {issueThreadStatus[thread.state]}</strong><br/>{thread.decisionReason}</p>}
      {thread.decisionReason && <h3>Original request</h3>}
      <p className={'issue-thread-body' + (thread.state === 'awaiting_tutor' ? ' issue-thread-warning' : '')}>{thread.body}</p>
      {thread.replies.map(reply => <div className="issue-thread-reply" key={reply.id}><strong>{reply.role === 'admin' ? 'Staff' : 'Tutor'}</strong> <time>{date(reply.createdAt)}</time><p className="issue-thread-body">{reply.body}</p>
        <div className="issue-thread-images">{reply.attachments?.map(a => <a key={a.id} href={imageUrl(thread.id,a.id)} target="_blank" rel="noopener noreferrer"><img src={imageUrl(thread.id,a.id)} loading="lazy" alt="Lesson issue attachment"/></a>)}</div></div>)}
      <form onSubmit={async event => {
        event.preventDefault(); if (busy) return;
        const form = event.currentTarget, formData = new FormData(form), text = String(formData.get('text') || '').trim();
        if (text.length < 10) { setError('Please provide at least 10 characters.'); return; }
        setBusy(true);
        try {
          const images = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
          if (images.length > 3 || images.some(f => f.size > 5 * 1024 * 1024)) throw Error('Choose up to 3 images, at most 5 MB each.');
          if (images.length) { const data = new FormData(); data.set('text',text); images.forEach(f => data.append('images',f)); await apiClient.post('/inbox/lesson-issues/' + encodeURIComponent(thread.id) + '/replies-with-images?admin=true', data, { headers: { 'Content-Type': undefined } }); }
          else await apiClient.post('/inbox/lesson-issues/' + encodeURIComponent(thread.id) + '/replies?admin=true', { text });
          form.reset(); setRevision(v => v + 1);
        }
        catch (e: any) { setError(e.response?.data?.error || e.message || 'Could not send reply. Please retry.'); }
        finally { setBusy(false); }
      }}><label>Staff reply<textarea name="text" required minLength={10} maxLength={2000} disabled={busy}/></label>
        <label>Images (up to 3, 5 MB each)<input type="file" name="images" multiple accept="image/jpeg,image/png,image/webp" disabled={busy}/></label>
        <button type="submit" disabled={busy}><i className="ri-send-plane-line" aria-hidden="true"/>Send reply</button></form>
      <form className="issue-thread-decision" onSubmit={async event => {
        event.preventDefault(); if (busy) return;
        const form = event.currentTarget, data = new FormData(form), decision = String(data.get('decision')), reason = String(data.get('reason')).trim();
        if (!confirm(`Apply ${decision === 'past' ? 'Delete slot (PAST)' : decision === 'ta301' ? 'TA-301' : 'No penalty'} to this lesson?`)) return;
        setBusy(true);
        try { await apiClient.post('/inbox/lesson-issues/' + encodeURIComponent(thread.id) + '/decision?admin=true', { decision, reason, expectedRevision: thread.decisionRevision || 0 }); form.reset(); setRevision(v => v + 1); }
        catch (e: any) { setError(e.response?.data?.error || 'Decision could not be saved. Refresh before retrying.'); }
        finally { setBusy(false); }
      }}><h3>Staff decision</h3><label>Outcome<select aria-label="Staff outcome" name="decision" required disabled={busy}><option value="">Choose outcome</option><option value="ta301">TA-301</option><option value="no_penalty">No penalty</option><option value="past">Delete slot (PAST)</option></select></label>
        <label>Decision reason<textarea name="reason" required minLength={10} maxLength={2000} disabled={busy}/></label>
        <button type="submit" disabled={busy}><i className="ri-check-line" aria-hidden="true"/>Apply decision</button></form>
    </details>)}
  </section>;
}
