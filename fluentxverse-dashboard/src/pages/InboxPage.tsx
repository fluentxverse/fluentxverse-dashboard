import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { ComponentChildren } from 'preact';
import { adminApi, type SystemMessage, type MessageCategory, type TargetAudience, type MessagePriority } from '../api/admin.api';
import { useAuthContext } from '../context/AuthContext';
import { AdminArt } from '../components/AdminArt';
import './InboxPage.css';

const categories: { value: MessageCategory; label: string; icon: string }[] = [
  { value: 'announcement', label: 'Announcement', icon: 'megaphone-line' },
  { value: 'update', label: 'Update', icon: 'refresh-line' },
  { value: 'alert', label: 'Alert', icon: 'alert-line' },
  { value: 'news', label: 'News', icon: 'newspaper-line' },
  { value: 'promotion', label: 'Promotion', icon: 'gift-line' },
];
const audiences: { value: TargetAudience; label: string }[] = [
  { value: 'all', label: 'Everyone' }, { value: 'students', label: 'Students' }, { value: 'tutors', label: 'Tutors' },
];
const priorities: MessagePriority[] = ['low', 'normal', 'high', 'urgent'];
const PAGE_SIZE = 20;
const categoryFor = (value: MessageCategory) => categories.find(category => category.value === value) || categories[0];
const audienceLabel = (value: TargetAudience) => audiences.find(audience => audience.value === value)?.label || value;
const formatDate = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';
const Icon = ({ name, spin = false }: { name: string; spin?: boolean }) => <i className={`ri-${name}${spin ? ' sysmsg-spin' : ''}`} aria-hidden="true"/>;
type MessageForm = { title: string; content: string; category: MessageCategory; targetAudience: TargetAudience; priority: MessagePriority };
const initialForm: MessageForm = { title: '', content: '', category: 'announcement', targetAudience: 'all', priority: 'normal' };

function MessageDialog({ title, icon, busy = false, onClose, children, small = false }: { title: string; icon: string; busy?: boolean; onClose: () => void; children: ComponentChildren; small?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.showModal();
    return () => { ref.current?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className={`sysmsg-dialog${small ? ' sysmsg-dialog-small' : ''}`} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} onClick={event => {
    const dialog = ref.current;
    if (!dialog || event.target !== dialog || busy) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className="sysmsg-dialog-heading"><div><span className="sysmsg-dialog-icon"><Icon name={icon}/></span><h2>{title}</h2></div><button type="button" className="sysmsg-icon-btn" title={`Close ${title.toLowerCase()}`} aria-label={`Close ${title.toLowerCase()}`} disabled={busy} onClick={onClose}><Icon name="close-line"/></button></header>
    {children}
  </dialog>, document.body);
}

export default function InboxPage() {
  const { user: admin } = useAuthContext();
  const [messages, setMessages] = useState<SystemMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [category, setCategory] = useState<MessageCategory | ''>('');
  const [audience, setAudience] = useState<TargetAudience | ''>('');
  const [showComposer, setShowComposer] = useState(false);
  const [editing, setEditing] = useState<SystemMessage | null>(null);
  const [preview, setPreview] = useState<SystemMessage | null>(null);
  const [deleting, setDeleting] = useState<SystemMessage | null>(null);
  const [form, setForm] = useState<MessageForm>(initialForm);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  const mutationPending = useRef(false);
  const loadMessages = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError('');
    try {
      const result = await adminApi.getSystemMessages({ category: category || undefined, targetAudience: audience || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
      if (request !== requestId.current) return;
      setMessages(result.messages); setTotal(result.total);
      if (!result.messages.length && page > 0) setPage(Math.max(0, Math.ceil(result.total / PAGE_SIZE) - 1));
    } catch (cause: any) {
      if (request === requestId.current) setError(cause.message || 'Could not load messages.');
    } finally { if (request === requestId.current) setLoading(false); }
  }, [category, audience, page]);
  useEffect(() => { setMessages([]); setTotal(0); void loadMessages(); return () => { requestId.current++; }; }, [loadMessages]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const resetFilters = () => { setCategory(''); setAudience(''); setPage(0); };
  const openComposer = (message?: SystemMessage) => {
    setEditing(message || null); setPreview(null); setActionError('');
    setForm(message ? { title: message.title, content: message.content, category: message.category, targetAudience: message.targetAudience, priority: message.priority } : { ...initialForm, category: category || 'announcement', targetAudience: audience || 'all' });
    setShowComposer(true);
  };
  const saveMessage = async (event: Event) => {
    event.preventDefault();
    if (mutationPending.current || !form.title.trim() || !form.content.trim()) return;
    mutationPending.current = true; setBusy(true); setActionError('');
    try {
      const data = { ...form, title: form.title.trim(), content: form.content.trim() };
      if (editing) await adminApi.updateSystemMessage(editing.id, data);
      else await adminApi.createSystemMessage({ ...data, createdBy: admin?.userId || 'admin' });
      setShowComposer(false); setNotice(editing ? 'Message updated.' : 'Message sent.');
      await loadMessages();
    } catch (cause: any) { setActionError(cause.message || 'Could not save the message. Your text has been kept.'); }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const deleteMessage = async () => {
    if (!deleting || mutationPending.current) return;
    mutationPending.current = true; setBusy(true); setActionError('');
    try { await adminApi.deleteSystemMessage(deleting.id); setDeleting(null); setNotice('Message deleted.'); await loadMessages(); }
    catch (cause: any) { setActionError(cause.message || 'Could not delete the message.'); }
    finally { mutationPending.current = false; setBusy(false); }
  };
  const filtered = Boolean(category || audience);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return <div className="inbox-page sysmsg-page">
    <header className="sysmsg-heading"><div className="sysmsg-heading-copy"><AdminArt name="community"/><div><h1>System Messages</h1><p>Announcements & platform updates</p></div></div><button type="button" className="sysmsg-btn sysmsg-btn-primary" onClick={() => openComposer()}><Icon name="add-line"/>New message</button></header>
    {notice && <div className="sysmsg-banner sysmsg-success" role="status"><Icon name="checkbox-circle-line"/><span>{notice}</span><button type="button" className="sysmsg-icon-btn" aria-label="Dismiss confirmation" title="Dismiss confirmation" onClick={() => setNotice('')}><Icon name="close-line"/></button></div>}
    <section className="sysmsg-workspace" aria-label="System messages">
      <div className="sysmsg-toolbar">
        <label>Category<select aria-label="Category" value={category} onChange={event => { setCategory(event.currentTarget.value as MessageCategory | ''); setPage(0); }}><option value="">All categories</option>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>Audience<select aria-label="Audience" value={audience} onChange={event => { setAudience(event.currentTarget.value as TargetAudience | ''); setPage(0); }}><option value="">All audiences</option>{audiences.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        {filtered && <button type="button" className="sysmsg-filter-reset" onClick={resetFilters}><Icon name="close-line"/>Clear filters</button>}
        <div className="sysmsg-toolbar-end"><span>{total} {total === 1 ? 'message' : 'messages'}</span><button type="button" className="sysmsg-icon-btn" title="Refresh messages" aria-label="Refresh messages" disabled={loading} onClick={() => void loadMessages()}><Icon name="refresh-line" spin={loading}/></button></div>
      </div>
      {error && <div className="sysmsg-banner sysmsg-error" role="alert"><Icon name="error-warning-line"/><span>{error}</span><button type="button" className="sysmsg-text-btn" disabled={loading} onClick={() => void loadMessages()}>Retry</button></div>}
      <div className="sysmsg-list" aria-busy={loading}>
        {loading && !messages.length ? <div className="sysmsg-loading" role="status" aria-label="Loading messages">{[0, 1, 2].map(key => <div key={key} className="sysmsg-skeleton"><span/><div><span/><span/></div></div>)}<span className="sr-only">Loading messages...</span></div> : !messages.length ? !error && <div className="sysmsg-empty">
          <span className="sysmsg-empty-icon"><Icon name={filtered ? 'filter-3-line' : 'mail-send-line'}/></span>
          <h2>{filtered ? 'No matching messages' : 'No messages yet'}</h2><p>{filtered ? 'No announcements match this category and audience.' : 'Your published announcements will appear here.'}</p>
          <button type="button" className={`sysmsg-btn ${filtered ? 'sysmsg-btn-secondary' : 'sysmsg-btn-primary'}`} onClick={() => filtered ? resetFilters() : openComposer()}><Icon name={filtered ? 'restart-line' : 'add-line'}/>{filtered ? 'Clear filters' : 'Create message'}</button>
        </div> : <>
          <div className="sysmsg-columns" aria-hidden="true"><span>Message</span><span>Audience</span><span>Priority</span><span>Published (PHT)</span><span className="sr-only">Actions</span></div>
          {messages.map(message => <article key={message.id} className={`sysmsg-row sysmsg-priority-${message.priority}`}>
            <div className="sysmsg-message-cell"><span className={`sysmsg-category-icon sysmsg-category-${message.category}`}><Icon name={categoryFor(message.category).icon}/></span><div className="sysmsg-message-copy"><span className={`sysmsg-category-label sysmsg-category-${message.category}`}>{categoryFor(message.category).label}</span><h2><button type="button" onClick={() => setPreview(message)}>{message.title}</button></h2><p>{message.content}</p></div></div>
            <span className="sysmsg-audience"><Icon name={message.targetAudience === 'students' ? 'graduation-cap-line' : message.targetAudience === 'tutors' ? 'presentation-line' : 'group-line'}/>{audienceLabel(message.targetAudience)}</span>
            <span className={`sysmsg-priority sysmsg-priority-${message.priority}`}><span/>{message.priority}</span>
            <time className="sysmsg-date" dateTime={message.createdAt}>{formatDate(message.createdAt)}</time>
            <div className="sysmsg-row-actions"><button type="button" className="sysmsg-icon-btn" title="Edit message" aria-label={`Edit ${message.title}`} onClick={() => openComposer(message)}><Icon name="edit-line"/></button><button type="button" className="sysmsg-icon-btn sysmsg-delete-tool" title="Delete message" aria-label={`Delete ${message.title}`} onClick={() => { setActionError(''); setDeleting(message); }}><Icon name="delete-bin-line"/></button></div>
          </article>)}
        </>}
      </div>
      {total > 0 && <footer className="sysmsg-pagination"><span>{messages.length ? `${page * PAGE_SIZE + 1}-${page * PAGE_SIZE + messages.length} of ${total}` : `0 of ${total}`}</span><div><button type="button" className="sysmsg-icon-btn" aria-label="Previous page" title="Previous page" disabled={!page || loading} onClick={() => setPage(value => value - 1)}><Icon name="arrow-left-s-line"/></button><span>Page {page + 1} of {pages}</span><button type="button" className="sysmsg-icon-btn" aria-label="Next page" title="Next page" disabled={page + 1 >= pages || loading} onClick={() => setPage(value => value + 1)}><Icon name="arrow-right-s-line"/></button></div></footer>}
    </section>

    {showComposer && <MessageDialog title={editing ? 'Edit message' : 'New message'} icon={editing ? 'edit-line' : 'mail-add-line'} busy={busy} onClose={() => setShowComposer(false)}>
      <form onSubmit={saveMessage} className="sysmsg-compose">
        <fieldset disabled={busy}>
          <div className="sysmsg-form-options"><label>Category<select aria-label="Category" value={form.category} onChange={event => setForm({ ...form, category: event.currentTarget.value as MessageCategory })}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Audience<select aria-label="Audience" value={form.targetAudience} onChange={event => setForm({ ...form, targetAudience: event.currentTarget.value as TargetAudience })}>{audiences.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>Priority<select aria-label="Priority" value={form.priority} onChange={event => setForm({ ...form, priority: event.currentTarget.value as MessagePriority })}>{priorities.map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label></div>
          <label>Title<input autoFocus type="text" value={form.title} onInput={event => setForm({ ...form, title: event.currentTarget.value })} placeholder="Message title" required/></label>
          <label>Message<textarea rows={8} value={form.content} onInput={event => setForm({ ...form, content: event.currentTarget.value })} placeholder="Write your announcement..." required/></label>
        </fieldset>
        <div className="sysmsg-recipient-note"><Icon name="group-line"/><span>Audience: <strong>{audienceLabel(form.targetAudience)}</strong></span></div>
        {actionError && <p className="sysmsg-form-error" role="alert"><Icon name="error-warning-line"/>{actionError}</p>}
        <footer className="sysmsg-dialog-footer"><button type="button" className="sysmsg-btn sysmsg-btn-secondary" disabled={busy} onClick={() => setShowComposer(false)}>Cancel</button><button type="submit" className="sysmsg-btn sysmsg-btn-primary" disabled={busy || !form.title.trim() || !form.content.trim()}><Icon name={busy ? 'loader-4-line' : editing ? 'save-line' : 'send-plane-line'} spin={busy}/>{busy ? 'Saving...' : editing ? 'Save changes' : 'Send message'}</button></footer>
      </form>
    </MessageDialog>}
    {preview && <MessageDialog title="Message details" icon={categoryFor(preview.category).icon} onClose={() => setPreview(null)}>
      <div className="sysmsg-preview"><span className={`sysmsg-category-label sysmsg-category-${preview.category}`}>{categoryFor(preview.category).label}</span><h3>{preview.title}</h3><div className="sysmsg-preview-meta"><span>{audienceLabel(preview.targetAudience)}</span><span>{preview.priority} priority</span><time dateTime={preview.createdAt}>{formatDate(preview.createdAt)} PHT</time></div><p>{preview.content}</p></div><footer className="sysmsg-dialog-footer"><button type="button" className="sysmsg-btn sysmsg-btn-secondary" onClick={() => setPreview(null)}>Close</button><button type="button" className="sysmsg-btn sysmsg-btn-primary" onClick={() => openComposer(preview)}><Icon name="edit-line"/>Edit message</button></footer>
    </MessageDialog>}
    {deleting && <MessageDialog title="Delete message" icon="delete-bin-line" small busy={busy} onClose={() => setDeleting(null)}>
      <div className="sysmsg-delete-copy"><p>Delete this announcement from the platform inboxes?</p><strong>{deleting.title}</strong><span>This cannot be undone.</span>{actionError && <p className="sysmsg-form-error" role="alert">{actionError}</p>}</div><footer className="sysmsg-dialog-footer"><button type="button" className="sysmsg-btn sysmsg-btn-secondary" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" className="sysmsg-btn sysmsg-btn-danger" disabled={busy} onClick={() => void deleteMessage()}><Icon name={busy ? 'loader-4-line' : 'delete-bin-line'} spin={busy}/>{busy ? 'Deleting...' : 'Delete message'}</button></footer>
    </MessageDialog>}
  </div>;
}
