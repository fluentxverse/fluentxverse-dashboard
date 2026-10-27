import { useEffect, useRef, useState } from 'preact/hooks';
import { mailApi, type MailAccount, type MailDraft, type MailPreferences } from '../../api/mail.api';
import MailEditor, { type MailEditorHandle } from './MailEditor';
import { INLINE_IMAGE_LIMIT, inlineImageBytes, prepareInlineImage, safeComposeLink } from './mailCompose';
import { fileSize, MailDialog, MailIcon, MailTool } from './MailUi';
import './MailComposer.css';

const escape = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!));
export function emptyDraft(account: MailAccount, signature = ''): MailDraft {
  return { id: crypto.randomUUID(), accountId: account.id, to: '', cc: '', bcc: '', subject: '', text: signature ? `\n\n${signature}` : '',
    html: signature ? `<p><br></p><p><br></p><p>${escape(signature).replace(/\n/g, '<br>')}</p>` : '', attachments: [], inReplyTo: '', references: [], revision: 0, updatedAt: '' };
}
const emojiOptions = [
  ['Smile', '\u{1F642}'], ['Grin', '\u{1F600}'], ['Laugh', '\u{1F604}'], ['Wink', '\u{1F609}'], ['Celebrate', '\u{1F389}'], ['Heart', '\u{2764}\u{FE0F}'],
  ['Thumbs up', '\u{1F44D}'], ['Thank you', '\u{1F64F}'], ['Wave', '\u{1F44B}'], ['Clap', '\u{1F44F}'], ['Handshake', '\u{1F91D}'], ['Strong', '\u{1F4AA}'],
  ['Check', '\u{2705}'], ['Star', '\u{2B50}'], ['Light bulb', '\u{1F4A1}'], ['Target', '\u{1F3AF}'], ['Rocket', '\u{1F680}'], ['Sparkles', '\u{2728}'],
  ['Calendar', '\u{1F4C5}'], ['Books', '\u{1F4DA}'], ['Pencil', '\u{270F}\u{FE0F}'], ['Computer', '\u{1F4BB}'], ['Coffee', '\u{2615}'], ['Globe', '\u{1F30D}'],
];
type ComposePopup = '' | 'link' | 'drive' | 'emoji' | 'signature' | 'more' | 'send' | 'discard';
export function MailComposer({ initial, account, preferences, onClose, onSaved, onSent, onDiscard }: {
  initial: MailDraft; account: MailAccount; preferences: MailPreferences; onClose: () => void;
  onSaved: (draft: MailDraft) => void; onSent: (warning?: string) => void;
  onDiscard?: (id: string) => void;
}) {
  const [draft, setDraft] = useState(initial), current = useRef(initial), revision = useRef(initial.revision);
  const [version, setVersion] = useState(0), edits = useRef(0), savedEdits = useRef(0);
  const [saving, setSaving] = useState(false), [sending, setSending] = useState(false), [error, setError] = useState('');
  const [ccOpen, setCcOpen] = useState(Boolean(initial.cc)), [bccOpen, setBccOpen] = useState(Boolean(initial.bcc));
  const [confirmClose, setConfirmClose] = useState(false), [uncertain, setUncertain] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [maximized, setMaximized] = useState(false), [minimized, setMinimized] = useState(false), [formatting, setFormatting] = useState(true);
  const [plain, setPlain] = useState(!initial.html && Boolean(initial.text)), [popup, setPopup] = useState<ComposePopup>('');
  const [linkUrl, setLinkUrl] = useState(''), [linkText, setLinkText] = useState(''), [popupError, setPopupError] = useState('');
  const [signature, setSignature] = useState(preferences.signature), [processing, setProcessing] = useState(false);
  const editor = useRef<MailEditorHandle | null>(null), imageInput = useRef<HTMLInputElement>(null), popupRef = useRef<HTMLDivElement>(null), fileLock = useRef(false);
  const inFlight = useRef<Promise<MailDraft> | null>(null), alive = useRef(true), requestId = useRef(crypto.randomUUID());
  const sendingRef = useRef(false), fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!popup) return;
    popupRef.current?.querySelector<HTMLElement>('input,textarea,button')?.focus();
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('[data-compose-popover],[data-compose-popup]')) setPopup('');
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [popup]);
  const openPopup = (value: ComposePopup) => {
    setPopupError('');
    if (value === 'link' || value === 'drive') { setLinkText(editor.current?.selectedText() || (value === 'drive' ? 'Google Drive file' : '')); setLinkUrl(''); }
    setPopup(previous => previous === value ? '' : value);
  };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const change = (patch: Partial<MailDraft>) => {
    if (sendingRef.current || attempted) return;
    current.current = { ...current.current, ...patch }; setDraft(current.current); edits.current++; setVersion(edits.current); setError('');
  };
  const dirty = version !== savedEdits.current;
  const save = async (): Promise<MailDraft> => {
    if (inFlight.current) await inFlight.current;
    if (revision.current && savedEdits.current === edits.current) return { ...current.current, revision: revision.current };
    const snapshot = { ...current.current, revision: revision.current }, atVersion = edits.current;
    setSaving(true); setError('');
    const pending = mailApi.saveDraft(snapshot); inFlight.current = pending;
    try {
      const data = await pending; revision.current = data.revision; savedEdits.current = atVersion;
      if (alive.current) { current.current = { ...current.current, revision: data.revision, updatedAt: data.updatedAt }; setDraft(current.current); onSaved(data); }
      return data;
    } catch (error: any) { if (alive.current) setError(error.message); throw error; }
    finally { inFlight.current = null; if (alive.current) setSaving(false); }
  };
  useEffect(() => {
    if (!dirty || saving || sending || error || uncertain) return;
    const timer = setTimeout(() => { void save().catch(() => {}); }, 1200);
    return () => clearTimeout(timer);
  }, [version, saving, sending, error, uncertain]);
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const navigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (target && !target.closest('dialog') && !window.confirm('Leave with unsaved email changes?')) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener('beforeunload', warn); document.addEventListener('click', navigation, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', navigation, true); };
  }, [dirty, saving]);
  const close = () => { setPopup(''); if (dirty || saving) setConfirmClose(true); else onClose(); };
  const send = async () => {
    if (sendingRef.current || uncertain || fileLock.current) return;
    sendingRef.current = true; setSending(true); setError('');
    try {
      const latest = await save(); setAttempted(true);
      const result = await mailApi.send(latest, requestId.current);
      if (result.status === 'sent') onSent(result.warning);
      else { setUncertain(true); setError(result.warning || 'A send is already in progress. Check Sent before creating another copy.'); }
    } catch (error: any) {
      // Never silently generate a new request ID after a network failure.
      setError(error.message || 'Send could not be confirmed. Retry uses the same send request.');
    } finally { sendingRef.current = false; if (alive.current) setSending(false); }
  };
  const attach = async (files: FileList | null) => {
    if (!files || sendingRef.current || attempted || fileLock.current) return;
    const picked = [...files], total = current.current.attachments.reduce((sum, file) => sum + file.data.length * .75, 0) + picked.reduce((sum, file) => sum + file.size, 0);
    if (total > 5 * 1024 * 1024 || picked.length + current.current.attachments.length > 10) { setError('Attach up to 10 files, totaling 5 MB or less.'); return; }
    fileLock.current = true; setProcessing(true);
    try {
      const additions = await Promise.all(picked.map(file => new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error('An attachment could not be read.'));
        reader.onload = () => resolve({ name: file.name, type: file.type || 'application/octet-stream', data: String(reader.result).split(',')[1] || '' }); reader.readAsDataURL(file);
      })));
      change({ attachments: [...current.current.attachments, ...additions] });
    } catch (error: any) { if (alive.current) setError(error.message); }
    finally { fileLock.current = false; if (alive.current) setProcessing(false); }
    if (fileInput.current) fileInput.current.value = '';
  };
  const insertImage = async (file?: File) => {
    if (!file || sendingRef.current || attempted || fileLock.current || plain) return;
    fileLock.current = true; setProcessing(true); setError('');
    try {
      const source = await prepareInlineImage(file, INLINE_IMAGE_LIMIT - inlineImageBytes(current.current.html));
      if (alive.current) editor.current?.insertImage(source, file.name);
    } catch (error: any) { if (alive.current) setError(error.message || 'Image could not be inserted.'); }
    finally { fileLock.current = false; if (alive.current) setProcessing(false); if (imageInput.current) imageInput.current.value = ''; }
  };
  const discard = async () => {
    if (sendingRef.current || attempted || saving || processing) return;
    setSaving(true); setError('');
    try { if (revision.current) await mailApi.deleteDraft(account.id, initial.id); onDiscard?.(initial.id); onClose(); }
    catch (error: any) { setError(error.message); }
    finally { if (alive.current) setSaving(false); }
  };
  const locked = sending || attempted;
  return <MailDialog title={initial.inReplyTo ? 'Reply' : initial.subject.startsWith('Fwd:') ? 'Forward message' : 'New message'} wide busy={sending || saving || processing} onClose={close}
    onEscape={() => { if (popup) { setPopup(''); editor.current?.focus(); } else close(); }}
    minimized={minimized} className={`mail-composer ${maximized ? 'mail-composer-maximized' : ''} ${minimized ? 'mail-composer-minimized' : ''}`}
    headerActions={<><MailTool icon={minimized ? 'expand-left-right-line' : 'subtract-line'} label={minimized ? 'Restore composer' : 'Minimize composer'} disabled={sending || processing} onClick={() => { setPopup(''); setMinimized(value => !value); }}/>
      {!minimized && <MailTool icon={maximized ? 'fullscreen-exit-line' : 'fullscreen-line'} label={maximized ? 'Restore composer size' : 'Maximize composer'} disabled={sending} onClick={() => setMaximized(value => !value)}/>}</>}>
    <div className="mail-compose-fields">
      <div className="mail-compose-from"><span>From</span><strong>{account.label}</strong><span>&lt;{account.address}&gt;</span></div>
      <label className="mail-address-field"><span>To</span><input aria-label="To recipients" list="mail-contact-suggestions" autoComplete="off" value={draft.to} disabled={sending || attempted} onInput={event => change({ to: event.currentTarget.value })}/>
        <button type="button" onClick={() => setCcOpen(!ccOpen)} aria-pressed={ccOpen}>Cc</button><button type="button" onClick={() => setBccOpen(!bccOpen)} aria-pressed={bccOpen}>Bcc</button></label>
      {ccOpen && <label className="mail-address-field"><span>Cc</span><input aria-label="Cc recipients" list="mail-contact-suggestions" value={draft.cc} disabled={sending || attempted} onInput={event => change({ cc: event.currentTarget.value })}/></label>}
      {bccOpen && <label className="mail-address-field"><span>Bcc</span><input aria-label="Bcc recipients" list="mail-contact-suggestions" value={draft.bcc} disabled={sending || attempted} onInput={event => change({ bcc: event.currentTarget.value })}/></label>}
      <datalist id="mail-contact-suggestions">{preferences.contacts.map(contact => <option key={contact.email} value={contact.email}>{contact.name}</option>)}</datalist>
      <label className="mail-address-field"><span>Subject</span><input aria-label="Subject" maxLength={998} value={draft.subject} disabled={sending || attempted} onInput={event => change({ subject: event.currentTarget.value })}/></label>
    </div>
    <div className="mail-compose-body"><MailEditor initialHtml={initial.html} initialText={initial.text} controller={editor} disabled={locked} plain={plain} formatting={formatting} onImagePaste={plain ? undefined : file => void insertImage(file)} onChange={(html, text) => change({ html, text })}/>
      {!!draft.attachments.length && <ul className="mail-file-list">{draft.attachments.map((file, index) => <li key={`${index}-${file.name}`}><MailIcon name="attachment-2"/><span>{file.name}<small>{fileSize(file.data.length * .75)}</small></span><MailTool icon="close-line" label={`Remove ${file.name}`} disabled={sending || attempted} onClick={() => change({ attachments: draft.attachments.filter((_, at) => at !== index) })}/></li>)}</ul>}
    </div>
    {error && <p className="mail-error" role="alert">{error}</p>}
    {confirmClose && <div className="mail-compose-confirm"><span>Keep your changes?</span><button type="button" disabled={saving} onClick={() => { void save().then(onClose).catch(() => {}); }}>Save & close</button><button type="button" disabled={saving} onClick={onClose}>Close without saving</button><button type="button" onClick={() => setConfirmClose(false)}>Keep editing</button></div>}
    <footer className="mail-compose-footer">
      <div className="mail-send-group"><button type="button" className="mail-primary" disabled={sending || saving || processing || uncertain || !draft.to.trim() || !draft.subject.trim() || !draft.text.trim()} onClick={() => void send()}><MailIcon name={sending ? 'loader-4-line' : 'send-plane-2-line'}/>{sending ? 'Sending...' : 'Send'}</button>
        <button type="button" className="mail-send-options" aria-label="Send options" title="Send options" data-compose-popup disabled={sending || saving || processing || uncertain} aria-expanded={popup === 'send'} onClick={() => openPopup('send')}><MailIcon name="arrow-down-s-line"/></button></div>
      <div className="mail-compose-actions">
        <MailTool icon="font-size-2" label="Formatting options" active={formatting && !plain} disabled={locked || plain} onClick={() => setFormatting(value => !value)}/>
        <MailTool icon="attachment-2" label="Attach files" disabled={locked || processing} onClick={() => fileInput.current?.click()}/>
        <span data-compose-popup><MailTool icon="link" label="Insert link" disabled={locked || plain} onClick={() => openPopup('link')}/></span>
        <span data-compose-popup><MailTool icon="emotion-happy-line" label="Insert emoji" disabled={locked} onClick={() => openPopup('emoji')}/></span>
        <span data-compose-popup><MailTool icon="drive-line" label="Insert Google Drive link" disabled={locked || plain} onClick={() => openPopup('drive')}/></span>
        <MailTool icon="image-line" label="Insert photo" disabled={locked || processing || plain} onClick={() => imageInput.current?.click()}/>
        <span data-compose-popup><MailTool icon="quill-pen-line" label="Insert signature" disabled={locked} onClick={() => openPopup('signature')}/></span>
        <MailTool icon="save-3-line" label="Save draft" disabled={saving || sending || processing || uncertain || (!dirty && Boolean(revision.current))} onClick={() => { void save().catch(() => {}); }}/>
        <span data-compose-popup><MailTool icon="more-2-fill" label="More compose options" disabled={sending || processing} onClick={() => openPopup('more')}/></span>
      </div>
      <input ref={fileInput} type="file" aria-label="Attachment files" multiple hidden onChange={event => void attach(event.currentTarget.files)}/>
      <input ref={imageInput} type="file" aria-label="Inline photo" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={event => void insertImage(event.currentTarget.files?.[0])}/>
      <span className="mail-save-state" role="status">{processing ? 'Preparing file...' : saving ? 'Saving...' : dirty ? 'Unsaved changes' : revision.current ? 'Draft saved' : 'New draft'}</span>
      <span className="mail-discard-action" data-compose-popup><MailTool icon="delete-bin-line" label="Discard draft" disabled={locked || saving || processing} onClick={() => openPopup('discard')}/></span>
      {popup && <div ref={popupRef} className={`mail-composer-popover mail-composer-popover-${popup}`} data-compose-popover role="dialog" aria-label={popup === 'link' ? 'Insert link' : popup === 'drive' ? 'Insert Google Drive link' : popup === 'emoji' ? 'Emoji' : popup === 'signature' ? 'Signature' : popup === 'discard' ? 'Discard draft' : popup === 'send' ? 'Send options' : 'More compose options'}
        onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setPopup(''); editor.current?.focus(); } }}>
        {(popup === 'link' || popup === 'drive') && <form onSubmit={event => {
          event.preventDefault(); const href = safeComposeLink(linkUrl);
          if (!href || (popup === 'drive' && !['drive.google.com', 'docs.google.com'].includes(new URL(href).hostname))) { setPopupError(popup === 'drive' ? 'Enter a drive.google.com or docs.google.com link.' : 'Enter an http, https, or mailto link.'); return; }
          editor.current?.insertLink(linkText.trim() || href, href); setPopup('');
        }}><h3>{popup === 'drive' ? 'Google Drive link' : 'Insert link'}</h3><label>Display text<input aria-label="Link display text" value={linkText} maxLength={1000} onInput={event => setLinkText(event.currentTarget.value)}/></label><label>URL<input aria-label="Link URL" required value={linkUrl} placeholder="https://" maxLength={2000} onInput={event => setLinkUrl(event.currentTarget.value)}/></label>{popupError && <p role="alert">{popupError}</p>}<div className="mail-popover-buttons"><button type="button" onClick={() => setPopup('')}>Cancel</button><button type="submit" className="mail-primary">Insert link</button></div></form>}
        {popup === 'emoji' && <><h3>Emoji</h3><div className="mail-emoji-grid">{emojiOptions.map(([name, value]) => <button type="button" key={name} title={name} aria-label={name} onClick={() => { editor.current?.insertText(value); setPopup(''); }}>{value}</button>)}</div></>}
        {popup === 'signature' && <form onSubmit={event => { event.preventDefault(); editor.current?.insertText(`\n${signature}\n`); setPopup(''); }}><h3>Signature</h3><label>Signature<textarea aria-label="Signature text" rows={4} maxLength={3000} value={signature} onInput={event => setSignature(event.currentTarget.value)}/></label><div className="mail-popover-buttons"><button type="button" onClick={() => setPopup('')}>Cancel</button><button type="submit" className="mail-primary" disabled={!signature.trim()}>Insert signature</button></div></form>}
        {popup === 'discard' && <><h3>Discard this draft?</h3><div className="mail-popover-buttons"><button type="button" onClick={() => setPopup('')}>Keep editing</button><button type="button" className="mail-danger-button" onClick={() => void discard()} disabled={saving}>Discard</button></div></>}
        {(popup === 'more' || popup === 'send') && <div className="mail-compose-menu">
          {popup === 'send' && <button type="button" disabled={sending || saving || processing || uncertain || !draft.to.trim() || !draft.subject.trim() || !draft.text.trim()} onClick={() => { setPopup(''); void send(); }}><MailIcon name="send-plane-2-line"/>Send now</button>}
          <button type="button" disabled={saving || locked} onClick={() => { setPopup(''); void save().then(onClose).catch(() => {}); }}><MailIcon name="save-line"/>Save and close</button>
          {popup === 'more' && <><label><input type="checkbox" checked={plain} disabled={locked} onChange={() => { if (!plain && !window.confirm('Switch to plain text? Formatting and inline images will be removed.')) return; setPlain(value => !value); setPopup(''); }}/><span>Plain text mode</span></label>
            <button type="button" onClick={() => { setPopup(''); window.print(); }}><MailIcon name="printer-line"/>Print draft</button>
            <button type="button" disabled={locked || saving} onClick={() => setPopup('discard')}><MailIcon name="delete-bin-line"/>Discard draft</button></>}
        </div>}
      </div>}
    </footer>
  </MailDialog>;
}
