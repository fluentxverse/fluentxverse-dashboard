import { useEffect, useRef, useState } from 'preact/hooks';
import { mailApi, type MailAccount, type MailDraft, type MailFolder, type MailMessage, type MailPage, type MailPreferences, type MailStatus, type MailSummary } from '../api/mail.api';
import type { MailAction } from '../../../shared/mail';
import { emptyDraft, MailComposer } from '../components/mail/MailComposer';
import MailSettings from '../components/mail/MailSettings';
import MailContent from '../components/mail/MailContent';
import MailMessageHeader from '../components/mail/MailMessageHeader';
import { fileSize, mailDate, MailDialog, MailIcon, MailTool } from '../components/mail/MailUi';
import { actionFlags, MailViewCache, mailMessageKey, mailViewKey, movesMessage, updateMailFolders, updateMailPage } from '../components/mail/mailViewState';
import './EmailPage.css';

const blankPage: MailPage = { messages: [], total: 0, page: 1, pages: 1, uidValidity: '' };
const folderIcon = (folder: MailFolder) => ({ inbox: 'inbox-2-line', sent: 'send-plane-line', drafts: 'draft-line', archive: 'archive-line', trash: 'delete-bin-line', junk: 'spam-2-line' }[folder.role] || 'folder-3-line');
const sender = (message: MailSummary) => message.from.map(address => address.name || address.address).join(', ') || 'Unknown sender';
const escape = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));

export default function EmailPage() {
  const [status, setStatus] = useState<MailStatus | null>(null), [statusError, setStatusError] = useState('');
  const [accountId, setAccountId] = useState(''), [folders, setFolders] = useState<MailFolder[]>([]), [folder, setFolder] = useState('INBOX');
  const [storedData, setStoredData] = useState<MailPage>(blankPage), [dataKey, setDataKey] = useState(''), [page, setPage] = useState(1), [filter, setFilter] = useState('all');
  const [query, setQuery] = useState(''), [search, setSearch] = useState(''), [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<number[]>([]), [opened, setOpened] = useState<number | null>(null), [storedMessage, setMessage] = useState<MailMessage | null>(null), [loadedMessageKey, setLoadedMessageKey] = useState('');
  const [loading, setLoading] = useState(false), [reading, setReading] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [readerError, setReaderError] = useState(''), [notice, setNotice] = useState('');
  const [drafts, setDrafts] = useState<MailDraft[]>([]), [composer, setComposer] = useState<MailDraft | null>(null);
  const [preferences, setPreferences] = useState<MailPreferences>({ signature: '', contacts: [] });
  const [settings, setSettings] = useState(false), [folderDialog, setFolderDialog] = useState(false), [folderName, setFolderName] = useState('');
  const [mobileFolders, setMobileFolders] = useState(false), [moveTarget, setMoveTarget] = useState('');
  const [listRefresh, setListRefresh] = useState(0), [folderRefresh, setFolderRefresh] = useState(0), [readerRefresh, setReaderRefresh] = useState(0);
  const alive = useRef(true), actionLock = useRef(false), cache = useRef(new MailViewCache()), forceList = useRef(false);
  const listController = useRef<AbortController | null>(null);
  const view = { accountId, folder, page, search, filter }, viewKey = mailViewKey(view), cachedPage = cache.current.page(view);
  const hasData = dataKey === viewKey || Boolean(cachedPage), data = dataKey === viewKey ? storedData : cachedPage || blankPage;
  const messageKey = opened === null ? '' : mailMessageKey(accountId, folder, data.uidValidity, opened);
  const message = loadedMessageKey === messageKey ? storedMessage : null;
  const setData = (value: MailPage) => { setStoredData(value); setDataKey(viewKey); };
  const account = status?.accounts.find(item => item.id === accountId);
  const listSender = (item: MailSummary) => folders.find(value => value.path === folder)?.role === 'sent' ? item.to.map(address => address.name || address.address).join(', ') || 'No recipients' : sender(item);
  const isDrafts = folder === '$drafts', visibleFolder = isDrafts ? 'Drafts' : folders.find(item => item.path === folder)?.name || 'Inbox';
  useEffect(() => { alive.current = true; document.title = 'Email | FluentXVerse'; return () => { alive.current = false; cache.current.clear(); }; }, []);
  useEffect(() => {
    cache.current.clear(); setFolders([]); setDrafts([]); setOpened(null); setMessage(null); setLoadedMessageKey(''); setSelected([]); setDataKey('');
  }, [accountId]);
  useEffect(() => {
    const controller = new AbortController();
    mailApi.status(controller.signal).then(value => { if (controller.signal.aborted) return; setStatus(value); setStatusError(''); setAccountId(current => value.accounts.some(item => item.id === current) ? current : value.accounts[0]?.id || ''); })
      .catch(error => { if (!controller.signal.aborted) setStatusError(error.message); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!status) return;
    let mounted = true;
    mailApi.preferences().then(value => { if (mounted) setPreferences(value); }).catch(error => { if (mounted) setError(error.message); });
    return () => { mounted = false; };
  }, [Boolean(status)]);
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    mailApi.folders(accountId, controller.signal).then(value => { if (!controller.signal.aborted) setFolders(value); }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [accountId, refresh, folderRefresh]);
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    mailApi.drafts(accountId, controller.signal).then(value => { if (!controller.signal.aborted) setDrafts(value); }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [accountId, refresh]);
  useEffect(() => {
    if (!accountId || isDrafts) { setLoading(false); return; }
    const cached = cache.current.page(view), forced = forceList.current; forceList.current = false;
    if (cached && !forced) { setData(cached); setLoading(false); return; }
    const controller = new AbortController(); listController.current = controller; setLoading(true); setError(''); setSelected([]);
    mailApi.list(accountId, folder, page, search, filter, controller.signal).then(response => {
      if (controller.signal.aborted) return;
      const value = cache.current.reconcilePage(view, response);
      cache.current.storePage({ ...view, page: value.page }, value); setData(value);
      if (value.page !== page) setPage(value.page);
    })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [accountId, folder, page, search, filter, refresh, listRefresh]);
  useEffect(() => {
    if (!accountId || opened === null || !data.uidValidity || isDrafts) return;
    const key = mailMessageKey(accountId, folder, data.uidValidity, opened), cached = cache.current.message(key);
    if (cached) { setMessage(cached); setLoadedMessageKey(key); setReading(false); setReaderError(''); return; }
    const controller = new AbortController(); setReading(message?.uid !== opened); setReaderError('');
    mailApi.message(accountId, folder, opened, data.uidValidity, controller.signal).then(value => { if (!controller.signal.aborted) { setMessage(cache.current.storeMessage(key, value)); setLoadedMessageKey(key); } })
      .catch(error => { if (!controller.signal.aborted) setReaderError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setReading(false); });
    return () => controller.abort();
  }, [accountId, folder, opened, data.uidValidity, refresh, readerRefresh]);
  const resetReader = () => { setOpened(null); setMessage(null); setLoadedMessageKey(''); setReading(false); setReaderError(''); setSelected([]); };
  const chooseFolder = (next: string) => { if (busy) return; setFolder(next); setPage(1); setSearch(''); setQuery(''); setFilter('all'); resetReader(); setMobileFolders(false); setError(''); };
  const changeAccount = (id: string) => { if (busy) return; cache.current.clear(); setAccountId(id); setFolders([]); setDataKey(''); setStoredData(blankPage); setDrafts([]); chooseFolder('INBOX'); };
  const reload = () => { cache.current.clear(); setRefresh(value => value + 1); };
  const refreshList = () => { forceList.current = true; setListRefresh(value => value + 1); };
  const run = async (task: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(''); setNotice('');
    try { await task(); } catch (error: any) { if (alive.current) setError(error.message); }
    finally { actionLock.current = false; if (alive.current) setBusy(false); }
  };
  const action = async (kind: MailAction, ids = selected, destination?: string) => run(async () => {
    if (!ids.length || !data.uidValidity) return;
    await mailApi.action(accountId, folder, data.uidValidity, ids, kind, destination);
    if (!alive.current) return;
    const known = [...data.messages, ...(message && !data.messages.some(row => row.uid === message.uid) ? [message] : [])];
    const target = destination || folders.find(item => item.role === ({ archive: 'archive', trash: 'trash', spam: 'junk' } as Record<string, string>)[kind])?.path;
    const next = updateMailPage(data, kind, ids, filter, known);
    cache.current.invalidateFolder(accountId, folder); cache.current.storePage(view, next); setData(next);
    setFolders(items => updateMailFolders(items, folder, target, kind, known.filter(row => ids.includes(row.uid))));
    for (const uid of ids) cache.current.patch(mailMessageKey(accountId, folder, data.uidValidity, uid), kind);
    if (movesMessage(kind)) {
      if (target) cache.current.invalidateFolder(accountId, target);
      if (opened !== null && ids.includes(opened)) resetReader();
    } else setMessage(current => current && ids.includes(current.uid) ? { ...current, ...actionFlags(kind) } : current);
    setSelected([]);
    if (movesMessage(kind) || filter !== 'all') { listController.current?.abort(); setLoading(false); refreshList(); }
  });
  const openMessage = (item: MailSummary) => {
    if (busy) return;
    const cached = cache.current.message(mailMessageKey(accountId, folder, data.uidValidity, item.uid));
    setOpened(item.uid); setLoadedMessageKey(mailMessageKey(accountId, folder, data.uidValidity, item.uid)); setMessage(cached || null); setReading(!cached); setReaderError(''); setMobileFolders(false);
    if (!item.seen) void action('read', [item.uid]);
  };
  const compose = (mode: 'new' | 'reply' | 'all' | 'forward' = 'new') => {
    if (!account) return;
    const draft = emptyDraft(account, preferences.signature);
    if (mode !== 'new' && message) {
      draft.subject = `${mode === 'forward' ? /^fwd:/i.test(message.subject) ? '' : 'Fwd: ' : /^re:/i.test(message.subject) ? '' : 'Re: '}${message.subject}`;
      const from = (message.replyTo?.length ? message.replyTo : message.from).map(item => item.address), other = mode === 'all' ? [...message.to, ...message.cc].map(item => item.address) : [];
      if (mode !== 'forward') {
        draft.to = [...new Set(from)].filter(item => item.toLowerCase() !== account.address.toLowerCase()).join(', ');
        draft.cc = [...new Set(other)].filter(item => item.toLowerCase() !== account.address.toLowerCase() && !from.includes(item)).join(', ');
        draft.inReplyTo = message.messageId; draft.references = [...message.references, message.messageId].filter(Boolean).slice(-30);
      }
      const quote = `\n\n${mode === 'forward' ? 'Forwarded message' : 'On ' + new Date(message.date).toLocaleString() + ', ' + sender(message) + ' wrote:'}\n${message.text}`;
      draft.text += quote; draft.html += `<blockquote><p>${escape(quote).replace(/\n/g, '<br>')}</p></blockquote>`;
    }
    if (mode === 'forward' && message?.attachments.length) {
      const original = message;
      void run(async () => {
        if (original.attachments.length > 10 || original.attachments.reduce((total, file) => total + file.size, 0) > 5 * 1024 * 1024) throw new Error('Original attachments exceed the 5 MB forwarding limit. Download them before composing a new message.');
        draft.attachments = await Promise.all(original.attachments.map(file => mailApi.attachmentFile(accountId, folder, original.uid, data.uidValidity, file.index, file.name, file.type)));
        setComposer(draft);
      });
    } else setComposer(draft);
  };
  const savedDraft = (draft: MailDraft) => setDrafts(items => [draft, ...items.filter(item => item.id !== draft.id)]);
  const targets = selected.length ? selected : opened === null ? [] : [opened];
  const filteredDrafts = drafts.filter(draft => `${draft.to} ${draft.subject} ${draft.text}`.toLowerCase().includes(search.toLowerCase()));
  const canMove = (role: string) => folders.some(item => item.role === role && item.path !== folder);
  const openedIndex = data.messages.findIndex(item => item.uid === opened);
  const mailboxTools = () => <><MailTool icon="refresh-line" label="Refresh email" onClick={reload} disabled={loading || busy}/><MailTool icon="settings-3-line" label="Email settings" onClick={() => setSettings(true)} disabled={!status || busy}/></>;
  return <div className="email-page">
    {statusError && <div className="mail-banner mail-error" role="alert"><MailIcon name="error-warning-line"/><span>{statusError}</span><button type="button" onClick={reload}>Retry</button></div>}
    {error && <div className="mail-banner mail-error" role="alert"><MailIcon name="error-warning-line"/><span>{error}</span><button type="button" onClick={reload}>Retry</button></div>}
    {notice && <div className="mail-banner mail-notice" role="status"><MailIcon name="checkbox-circle-line"/><span>{notice}</span><MailTool icon="close-line" label="Dismiss email notice" onClick={() => setNotice('')}/></div>}
    <section className={`mail-workspace ${opened !== null ? 'mail-reading' : ''} ${mobileFolders ? 'mail-folders-open' : ''}`} aria-label="Email workspace">
      <aside className="mail-folders" aria-label="Mail folders"><div className="mail-account-selector"><label htmlFor="mail-account">Mailbox</label><select id="mail-account" value={accountId} disabled={busy || !status?.accounts.length} onChange={event => changeAccount(event.currentTarget.value)}>{!status?.accounts.length && <option>No mailbox connected</option>}{status?.accounts.map(item => <option key={item.id} value={item.id}>{item.address}</option>)}</select></div>
        <button type="button" className="mail-primary mail-compose-button" disabled={!account || busy} onClick={() => compose()}><MailIcon name="edit-box-line"/>Compose</button>
        <nav aria-label="Email folders">
          {!account && <button type="button" className="active" disabled><MailIcon name="inbox-2-line"/>Inbox</button>}
          {folders.filter(item => item.role !== 'drafts').map(item => <button key={item.path} type="button" disabled={busy} className={folder === item.path ? 'active' : ''} onClick={() => chooseFolder(item.path)} aria-current={folder === item.path ? 'page' : undefined}><MailIcon name={folderIcon(item)}/><span>{item.name}</span>{item.unread > 0 && <small>{item.unread}</small>}</button>)}
          {account && <button type="button" disabled={busy} className={isDrafts ? 'active' : ''} onClick={() => chooseFolder('$drafts')} aria-current={isDrafts ? 'page' : undefined}><MailIcon name="draft-line"/><span>Drafts</span>{drafts.length > 0 && <small>{drafts.length}</small>}</button>}
        </nav>
        <div className="mail-folder-bottom"><button type="button" disabled={!account || busy} onClick={() => setFolderDialog(true)}><MailIcon name="folder-add-line"/>New folder</button><button type="button" disabled={!status || busy} onClick={() => setSettings(true)}><MailIcon name="contacts-book-3-line"/>Contacts & signature</button></div>
      </aside>
      <div className="mail-mailbox"><div className="mail-search-row"><MailTool icon="folder-3-line" label="Toggle mail folders" active={mobileFolders} onClick={() => setMobileFolders(!mobileFolders)}/><form onSubmit={event => { event.preventDefault(); if (busy) return; setSearch(query.trim()); setPage(1); resetReader(); }}><MailIcon name="search-line"/><input type="search" aria-label="Search email" placeholder="Search this folder" maxLength={200} value={query} onInput={event => setQuery(event.currentTarget.value)} disabled={!account || busy}/><MailTool type="submit" icon="arrow-right-line" label="Search folder" disabled={!account || busy}/></form><MailTool icon="edit-box-line" label="Compose new message" disabled={!account || busy} onClick={() => compose()}/>{mailboxTools()}</div>
        <div className="mail-list-heading"><h2>{visibleFolder}</h2><span>{isDrafts ? `${filteredDrafts.length} drafts` : `${data.total} messages`}</span>{!isDrafts && <select aria-label="Filter messages" value={filter} disabled={!account || busy} onChange={event => { setFilter(event.currentTarget.value); setPage(1); resetReader(); }}><option value="all">All mail</option><option value="unread">Unread</option><option value="starred">Starred</option></select>}</div>
        {!isDrafts && <div className="mail-bulk-toolbar"><input type="checkbox" aria-label="Select all messages on this page" disabled={!data.messages.length || busy || loading} checked={Boolean(data.messages.length && selected.length === data.messages.length)} onChange={event => setSelected(event.currentTarget.checked ? data.messages.map(item => item.uid) : [])}/><span className="mail-selection-count">{selected.length ? `${selected.length} selected` : ''}</span>
          <MailTool icon="archive-line" label="Archive selected messages" disabled={busy || !targets.length || !canMove('archive')} onClick={() => void action('archive', targets)}/><MailTool icon="mail-open-line" label="Mark selected as read" disabled={busy || !targets.length} onClick={() => void action('read', targets)}/><MailTool icon="mail-unread-line" label="Mark selected as unread" disabled={busy || !targets.length} onClick={() => void action('unread', targets)}/><MailTool icon="spam-2-line" label="Move selected to spam" disabled={busy || !targets.length || !canMove('junk')} onClick={() => void action('spam', targets)}/><MailTool icon="delete-bin-line" label="Move selected to trash" disabled={busy || !targets.length || !canMove('trash')} onClick={() => void action('trash', targets)}/>
          <select aria-label="Move selected messages" value={moveTarget} disabled={!targets.length || busy} onChange={event => { const destination = event.currentTarget.value; setMoveTarget(''); if (destination) void action('move', targets, destination); }}><option value="">Move to...</option>{folders.filter(item => item.path !== folder && item.role !== 'drafts').map(item => <option value={item.path} key={item.path}>{item.name}</option>)}</select>
        </div>}
        <div className="mail-list" aria-busy={loading}>
          {!status && !statusError ? <div className="mail-empty" role="status"><MailIcon name="loader-4-line"/><h3>Loading email...</h3></div> : !account ? <div className="mail-empty mail-unconnected"><MailIcon name="mail-settings-line"/><h3>No mailbox connected</h3><p>FluentXVerse Email</p><span className="mail-privacy-label"><MailIcon name="lock-2-line"/>Awaiting provider configuration</span></div>
            : !hasData && !error && !isDrafts ? <div className="mail-empty" role="status"><MailIcon name="loader-4-line"/><h3>Loading messages...</h3></div>
            : isDrafts ? filteredDrafts.length ? filteredDrafts.map(draft => <article className="mail-draft-row" key={draft.id}><button type="button" onClick={() => setComposer(draft)}><span className="mail-draft-tag">Draft</span><strong>{draft.subject || '(No subject)'}</strong><span>{draft.to || 'No recipients'}</span><time>{mailDate(draft.updatedAt)}</time></button><MailTool icon="delete-bin-line" label={`Delete draft ${draft.subject || 'without subject'}`} disabled={busy} onClick={() => { if (window.confirm('Delete this saved draft?')) void run(async () => { await mailApi.deleteDraft(accountId, draft.id); setDrafts(items => items.filter(item => item.id !== draft.id)); }); }}/></article>) : <div className="mail-empty"><MailIcon name="draft-line"/><h3>No drafts</h3></div>
            : data.messages.length ? data.messages.map(item => <article key={item.uid} className={`mail-message-row ${!item.seen ? 'unread' : ''} ${opened === item.uid ? 'opened' : ''}`}>
              <div className="mail-row-tools"><input type="checkbox" aria-label={`Select ${item.subject}`} disabled={busy} checked={selected.includes(item.uid)} onChange={event => setSelected(items => event.currentTarget.checked ? [...items, item.uid] : items.filter(uid => uid !== item.uid))}/><MailTool icon={item.starred ? 'star-fill' : 'star-line'} label={item.starred ? `Unstar ${item.subject}` : `Star ${item.subject}`} active={item.starred} disabled={busy} onClick={() => void action(item.starred ? 'unstar' : 'star', [item.uid])}/></div>
              <button type="button" className="mail-row-content" disabled={busy} onClick={() => openMessage(item)}><strong>{listSender(item)}</strong><span className="mail-row-subject">{item.subject}</span>{item.hasAttachments && <MailIcon name="attachment-2"/>}<time dateTime={item.date}>{mailDate(item.date)}</time>{!item.seen && <span className="mail-unread-dot" aria-label="Unread"/>}</button>
            </article>) : <div className="mail-empty"><MailIcon name={search || filter !== 'all' ? 'search-line' : 'inbox-2-line'}/><h3>{search || filter !== 'all' ? 'No matching messages' : 'No messages'}</h3>{(search || filter !== 'all') && <button type="button" onClick={() => { setSearch(''); setQuery(''); setFilter('all'); }}>Clear filters</button>}</div>}
        </div>
        {!isDrafts && account && <footer className="mail-pagination"><span>{data.messages.length ? `${(data.page - 1) * 25 + 1}-${Math.min((data.page - 1) * 25 + data.messages.length, data.total)} of ${data.total}` : '0 messages'}</span><div><MailTool icon="arrow-left-s-line" label="Previous message page" disabled={loading || busy || data.page <= 1} onClick={() => { setPage(data.page - 1); resetReader(); }}/><span>Page {data.page} of {data.pages}</span><MailTool icon="arrow-right-s-line" label="Next message page" disabled={loading || busy || data.page >= data.pages} onClick={() => { setPage(data.page + 1); resetReader(); }}/></div></footer>}
      </div>
      <section className="mail-reader" aria-label="Message reader"><header className="mail-reader-toolbar"><MailTool icon="arrow-left-line" label="Back to message list" onClick={resetReader}/>
        {message && <><MailTool icon="archive-line" label="Archive message" disabled={busy || !canMove('archive')} onClick={() => void action('archive', [message.uid])}/><MailTool icon="delete-bin-line" label="Delete message" disabled={busy || !canMove('trash')} onClick={() => void action('trash', [message.uid])}/><MailTool icon="mail-unread-line" label="Mark message as unread" disabled={busy} onClick={() => void action('unread', [message.uid])}/></>}
        <span/>{message && <><MailTool icon="reply-line" label="Reply to message" disabled={busy} onClick={() => compose('reply')}/><MailTool icon="reply-all-line" label="Reply to all" disabled={busy} onClick={() => compose('all')}/><MailTool icon="share-forward-line" label="Forward message" disabled={busy} onClick={() => compose('forward')}/></>}
        <MailTool icon="arrow-left-s-line" label="Previous message" disabled={busy || openedIndex <= 0} onClick={() => { const item = data.messages[openedIndex - 1]; if (item) openMessage(item); }}/><MailTool icon="arrow-right-s-line" label="Next message" disabled={busy || openedIndex < 0 || openedIndex >= data.messages.length - 1} onClick={() => { const item = data.messages[openedIndex + 1]; if (item) openMessage(item); }}/>
        {mailboxTools()}
      </header>
        {reading ? <div className="mail-empty" role="status"><MailIcon name="loader-4-line"/><h3>Opening message...</h3></div> : readerError ? <div className="mail-empty mail-error" role="alert"><MailIcon name="error-warning-line"/><p>{readerError}</p><button type="button" onClick={() => setReaderRefresh(value => value + 1)}>Retry</button></div> : message ? <div className="mail-reader-scroll" key={messageKey}>
          <MailMessageHeader message={message} address={account?.address || ''} busy={busy} onStar={() => void action(message.starred ? 'unstar' : 'star', [message.uid])}/>
          <MailContent key={messageKey} message={message}/>
          {!!message.attachments.length && <div className="mail-received-attachments"><h3><MailIcon name="attachment-2"/>Attachments <span>{message.attachments.length}</span></h3><ul className="mail-file-list">{message.attachments.map(file => <li key={file.index}><MailIcon name="file-text-line"/><span>{file.name}<small>{fileSize(file.size)}</small></span><MailTool icon="download-2-line" label={`Download ${file.name}`} disabled={busy} onClick={() => void run(async () => { await mailApi.attachment(accountId, folder, message.uid, data.uidValidity, file.index, file.name); })}/></li>)}</ul></div>}
          <div className="mail-reply-actions"><button type="button" onClick={() => compose('reply')}><MailIcon name="reply-line"/>Reply</button><button type="button" onClick={() => compose('all')}><MailIcon name="reply-all-line"/>Reply all</button><button type="button" onClick={() => compose('forward')}><MailIcon name="share-forward-line"/>Forward</button></div>
        </div> : <div className="mail-empty mail-reader-empty"><MailIcon name="mail-open-line"/><h3>{account ? 'Select a message' : 'Your email workspace'}</h3><span className="mail-privacy-label"><MailIcon name="shield-check-line"/>Remote images blocked</span></div>}
      </section>
    </section>
    {composer && account && <MailComposer key={composer.id} initial={composer} account={account} preferences={preferences} onClose={() => setComposer(null)} onDiscard={id => setDrafts(items => items.filter(item => item.id !== id))} onSaved={savedDraft} onSent={warning => {
      setDrafts(items => items.filter(item => item.id !== composer.id)); setComposer(null);
      const sent = folders.find(item => item.role === 'sent');
      if (sent) { cache.current.invalidateFolder(accountId, sent.path); if (folder === sent.path) refreshList(); }
      setFolderRefresh(value => value + 1); setNotice(warning || 'Message accepted by the email provider.');
    }}/ >}
    {settings && <MailSettings accounts={status?.accounts || []} preferences={preferences} onClose={() => setSettings(false)} onSaved={setPreferences}/>}
    {folderDialog && <MailDialog title="New folder" busy={busy} onClose={() => setFolderDialog(false)}><form className="mail-new-folder" onSubmit={event => { event.preventDefault(); void run(async () => { await mailApi.createFolder(accountId, folderName.trim()); setFolderDialog(false); setFolderName(''); setFolderRefresh(value => value + 1); }); }}><label htmlFor="mail-folder-name">Folder name</label><input id="mail-folder-name" autoFocus required maxLength={80} value={folderName} onInput={event => setFolderName(event.currentTarget.value)}/>{error && <p className="mail-error" role="alert">{error}</p>}<button type="submit" className="mail-primary" disabled={busy || !folderName.trim()}>Create folder</button></form></MailDialog>}
  </div>;
}
