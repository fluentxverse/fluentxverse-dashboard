import { useState, useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { apiClient } from '../api/apiClient';
import { acceptedTutorIds, type TutorIdentityRecord } from '../../../shared/tutorIdentity';
import '../../../shared/ui/tutor-identity.css';

function FraudConfirmation(props: { busy: boolean; error: string; reason: string; onClose: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.activeElement, dialog = ref.current!; dialog.showModal(); return () => { dialog.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); }; }, []);
  const close = () => { ref.current?.close(); props.onClose(); };
  return createPortal(<dialog ref={ref} className="identity-fraud-dialog" aria-labelledby="identity-fraud-title" onCancel={e => { e.preventDefault(); if (!props.busy) close(); }}>
    <h2 id="identity-fraud-title">Ban this applicant for confirmed fraud?</h2>
    <p>This will ban the applicant account, revoke their identity credential and cancel any booked interviews. Only continue if fraud has been confirmed.</p>
    <p className="identity-fraud-reason"><strong>Review reason</strong>{props.reason}</p>
    {props.error && <p role="alert">{props.error}</p>}
    <footer><button type="button" disabled={props.busy} onClick={close} autoFocus>Cancel</button><button type="button" className="identity-fraud-confirm" disabled={props.busy} onClick={props.onConfirm}>{props.busy ? 'Banning...' : 'Yes, ban account'}</button></footer>
  </dialog>, document.body);
}

export default function IdentityReview(props: { tutorId?: string; interviewId?: string; startPresentation?: () => Promise<void>; onResolved?: (mismatch: boolean) => void }) {
  const [items, setItems] = useState<TutorIdentityRecord[]>([]);
  const [selected, setSelected] = useState('');
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const [reason, setReason] = useState('');
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [confirmFraud, setConfirmFraud] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const imageGeneration = useRef(0);
  useEffect(() => { imageGeneration.current++; return () => { imageGeneration.current++; }; }, [selected]);
  const load = async () => {
    setLoading(true);
    try {
    const { data } = await apiClient.get('/tutor-identity/admin');
    if (!data.success) throw Error(data.error);
    const rows = (data.data as TutorIdentityRecord[]).filter(i => !props.tutorId || i.tutorId === props.tutorId);
    setItems(rows);
    if (props.tutorId && rows[0]) setSelected(rows[0].id);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load().catch(e => setError(e.response?.data?.error || e.message)); }, [props.tutorId]);
  useEffect(() => { setImage(''); setReason(''); setAdult(false); setPresenting(false); }, [selected]);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image); }, [image]);
  const item = items.find(i => i.id === selected);
  const visibleItems = items.filter(i => (statusFilter === 'all' || i.status === statusFilter) && (i.name || i.tutorId).toLowerCase().includes(query.trim().toLowerCase()));
  const type = acceptedTutorIds.find(i => i[0] === item?.idType);
  const openImage = async () => {
    const generation = ++imageGeneration.current;
    setBusy(true); setError('');
    try {
      const response = await apiClient.get(`/tutor-identity/admin/${selected}/image`, { responseType: 'blob' });
      if (response.data.type !== 'image/jpeg') throw Error('Image is unavailable.');
      if (generation !== imageGeneration.current) return;
      setImage(URL.createObjectURL(response.data));
    } catch { setError('ID image could not be opened. It may have been deleted.'); }
    finally { setBusy(false); }
  };
  const review = async (action: string) => {
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post(`/tutor-identity/admin/${selected}/review`, { action, reason, adultConfirmed: adult, interviewId: props.interviewId });
      if (!data.success) throw Error(data.error);
      setImage(''); setPresenting(false); setConfirmFraud(false); await load(); props.onResolved?.(action === 'mismatch' || action === 'fraud');
    } catch (e: any) { setError(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  const start = async () => {
    setBusy(true); setError('');
    try {
      await props.startPresentation?.();
      const { data } = await apiClient.post(`/tutor-identity/admin/presentation/${props.interviewId}`);
      if (!data.success) throw Error(data.error);
      setPresenting(true); await openImage();
    } catch (e: any) { setError(e.response?.data?.error || e.message); }
    finally { setBusy(false); }
  };
  return <section className="identity-section" aria-label="Identity review">
    <h2><i className="ri-shield-user-line" aria-hidden="true"/>Identity review</h2>
    {error && <p role="alert" className="identity-error">{error}</p>}
    <div className={props.tutorId ? '' : 'identity-review-layout'}>
      {!props.tutorId && <nav className="identity-review-list" aria-label="Identity submissions">
        <div className="identity-queue-heading"><h3>Applicants <span>{items.length}</span></h3><button disabled={loading} title="Refresh" aria-label="Refresh" onClick={() => void load().catch(e => setError(e.message))}><i className="ri-refresh-line" aria-hidden="true"/></button></div>
        <label className="identity-search"><i className="ri-search-line" aria-hidden="true"/><input aria-label="Search applicants" value={query} onInput={e => setQuery(e.currentTarget.value)} placeholder="Search applicants"/></label>
        <select className="identity-queue-filter" aria-label="Filter identity status" value={statusFilter} onChange={e => setStatusFilter(e.currentTarget.value)}><option value="all">All statuses</option><option value="pending_review">Pending review</option><option value="accepted">Accepted</option><option value="booked">Interview booked</option><option value="verified">Verified</option><option value="resubmit">Resubmission required</option><option value="expired">Expired</option><option value="fraud">Banned</option></select>
        {visibleItems.map(i => <button className="identity-queue-item" key={i.id} aria-pressed={i.id === selected} onClick={() => setSelected(i.id)}><span className="identity-queue-avatar" aria-hidden="true">{(i.name || 'A').charAt(0)}</span><span><strong>{i.name || i.tutorId}</strong><small>{i.status.replaceAll('_', ' ')}</small></span><i className="ri-arrow-right-s-line" aria-hidden="true"/></button>)}
        {items.length > 0 && !visibleItems.length && <p className="identity-queue-empty">No matching applicants.</p>}
        {loading && <p role="status">Loading submissions...</p>}
        {!loading && !items.length && <p>No identity submissions.</p>}
      </nav>}
      {item ? <div className="identity-review-detail">
        <header className="identity-detail-header"><div>{!props.tutorId && <h3 className="identity-applicant-name">{item.name || item.tutorId}</h3>}<h3>{type?.[1]}</h3></div><strong className={`identity-review-badge status-${item.status}`}>{item.status.replaceAll('_', ' ')}</strong></header>
        {item.bookingDeadline && <p>Booking deadline: {new Date(item.bookingDeadline).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} Manila</p>}
        <div className="identity-review-workspace"><section className="identity-document-area" aria-label="Submitted document">
        {!props.tutorId && !image && <div className="identity-document-placeholder"><i className="ri-file-user-line" aria-hidden="true"/><strong>{item.deletedAt ? 'Document deleted' : 'Submitted ID'}</strong></div>}
        {item.deletedAt ? <p>ID image deleted.</p> : <div className="identity-actions"><button disabled={busy} onClick={openImage}><i className="ri-eye-line" aria-hidden="true"/>View submitted ID</button>{image && <button onClick={() => setImage('')}><i className="ri-eye-off-line" aria-hidden="true"/>Hide ID</button>}</div>}
        {image && <img className="identity-document" src={image} alt="Private submitted identity document"/>}
        {type?.[2] ? <p><a href={type[2]} target="_blank" rel="noopener noreferrer">{['national', 'prc', 'pwd', 'nbi', 'police'].includes(item.idType) ? 'Official verification portal' : 'Official issuer guidance / contact'}</a></p> : <p>School ID: contact the issuing school using its independently verified official contact details.</p>}
        {item.idType === 'national' && <p><a href="https://psa.gov.ph/content/public-advisory-37" target="_blank" rel="noopener noreferrer">PSA verification advisory</a></p>}
        </section><section className="identity-decision-area" aria-label="Review decision">
        {!props.tutorId && <h3>Review decision</h3>}
        {props.interviewId && item.status === 'booked' && <div className="identity-actions"><button disabled={busy || presenting} onClick={start}><i className="ri-id-card-line"/>{presenting ? 'Unrecorded ID check in progress' : 'Start unrecorded ID check'}</button></div>}
        <div className="identity-form">
          <label>Review reason<textarea value={reason} maxLength={1000} onInput={e => setReason(e.currentTarget.value)} placeholder="Record your decision without copying ID numbers or other document details."/></label>
          <label className="identity-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.currentTarget.checked)}/>{props.interviewId ? 'Same submitted ID, document presented live, face and age 18+ match.' : 'I checked the document and confirmed the applicant is 18 or older.'}</label>
          <div className="identity-actions">
            {item.status === 'pending_review' && <><button className="identity-accept-action" disabled={busy || !adult || !reason.trim()} onClick={() => review('accept')}><i className="ri-check-line" aria-hidden="true"/>Accept ID</button><button disabled={busy || !reason.trim()} onClick={() => review('resubmit')}>Request resubmission</button></>}
            {props.interviewId && item.status === 'booked' && <><button disabled={busy || !presenting || !adult || !reason.trim()} onClick={() => review('match')}><i className="ri-check-line" aria-hidden="true"/>Match</button><button disabled={busy || !presenting || !reason.trim()} onClick={() => review('mismatch')}><i className="ri-close-line" aria-hidden="true"/>Mismatch and stop interview</button></>}
          </div>
          {item.status !== 'fraud' && <div className="identity-fraud-action"><button disabled={busy || !reason.trim()} onClick={() => { setError(''); setConfirmFraud(true); }}><i className="ri-alert-line" aria-hidden="true"/>Confirmed fraud: ban account</button></div>}
        </div>
        {item.credentialStatus && <p>Credential: {item.credentialStatus.replaceAll('_', ' ')}</p>}
        </section></div>
      </div> : <div className="identity-review-empty"><i className="ri-shield-user-line" aria-hidden="true"/><h3>{props.tutorId ? 'No ID submission for this applicant.' : 'Select an applicant'}</h3></div>}
    </div>
    {confirmFraud && <FraudConfirmation busy={busy} error={error} reason={reason} onClose={() => setConfirmFraud(false)} onConfirm={() => void review('fraud')}/>}
  </section>;
}
