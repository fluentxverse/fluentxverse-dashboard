import { useEffect, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { compensationApi, usdRateLabel } from '../api/compensation.api';
import { operationError } from '../api/operations.api';
import { dateText, IconButton } from './OperationsShared';
import { usdRateCents, usdRateInput, type TutorCompensationDetail, type TutorRateUpdate } from '../../../fluentxverse-server/src/shared/tutorCompensation';
import './TutorCompensation.css';

function RateConfirmation({ draft, previous, busy, error, onClose, onConfirm }: {
  draft: TutorRateUpdate; previous: number | null; busy: boolean; error: string; onClose: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return createPortal(<dialog className="operations-dialog lesson-operations compensation-confirmation" ref={ref}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <header><h2>{previous === null ? 'Set base rate' : 'Change base rate'}</h2><IconButton icon="close" title="Close confirmation" disabled={busy} onClick={onClose} /></header>
    <dl><div><dt>Current USD rate</dt><dd>{usdRateLabel(previous)}</dd></div><div><dt>New USD rate</dt><dd>{usdRateLabel(usdRateCents(draft.amount))}</dd></div></dl>
    <p className="compensation-confirmation-reason">{draft.reason || 'Initial base rate'}</p>
    {error && <p className="operations-error" role="alert">{error}</p>}
    <footer><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="operations-primary" disabled={busy} onClick={onConfirm}><i aria-hidden="true" className="ri-save-3-line" />{busy ? 'Saving...' : 'Confirm rate'}</button></footer>
  </dialog>, document.body);
}

export function TutorCompensation({ tutorId }: { tutorId: string }) {
  const [data, setData] = useState<TutorCompensationDetail | null>(null);
  const [amount, setAmount] = useState(''), [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState(''), [success, setSuccess] = useState(''), [conflict, setConflict] = useState(false);
  const [draft, setDraft] = useState<TutorRateUpdate | null>(null), [saveError, setSaveError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; }; }, [tutorId]);

  async function load() {
    setLoading(true); setError('');
    try {
      const detail = await compensationApi.detail(tutorId);
      if (!alive.current) return;
      setData(detail); setAmount(detail.compensation.baseRateCents === null ? '' : usdRateInput(detail.compensation.baseRateCents));
      setReason(''); setConflict(false);
    } catch (failure: any) { if (alive.current) { if ([403, 404].includes(failure.response?.status)) setData(null); setError(operationError(failure)); } }
    finally { if (alive.current) setLoading(false); }
  }

  function preview(event: Event) {
    event.preventDefault(); setError(''); setSuccess('');
    if (!data || loading || saving || conflict) return;
    try {
      const cents = usdRateCents(amount.trim());
      if (cents === data.compensation.baseRateCents) throw Error('The base rate is unchanged.');
      if (data.compensation.version > 0 && !reason.trim()) throw Error('A reason is required when changing an existing rate.');
      setSaveError(''); setDraft({ amount: usdRateInput(cents), currency: 'USD', expectedVersion: data.compensation.version, requestId: crypto.randomUUID(), reason: reason.trim() });
    } catch (failure) { setError(operationError(failure)); }
  }

  async function confirm() {
    if (!draft || saving) return;
    setSaving(true); setSaveError('');
    try {
      await compensationApi.save(tutorId, draft);
      if (!alive.current) return;
      setDraft(null); setSuccess('Base rate saved.');
      await load();
    } catch (failure: any) {
      if (!alive.current) return;
      if ([403, 404].includes(failure.response?.status)) {
        setDraft(null); setData(null); setError(operationError(failure));
      } else if (failure.response?.status === 409) {
        setDraft(null); setConflict(true); setError(operationError(failure));
      } else setSaveError(operationError(failure));
    } finally { if (alive.current) setSaving(false); }
  }

  async function more() {
    if (!data?.nextHistoryBeforeVersion || moreLoading) return;
    setMoreLoading(true); setError('');
    try {
      const result = await compensationApi.detail(tutorId, data.nextHistoryBeforeVersion);
      if (alive.current) setData(previous => previous && ({ ...previous,
        history: [...new Map([...previous.history, ...result.history].map(item => [item.id, item])).values()], nextHistoryBeforeVersion: result.nextHistoryBeforeVersion }));
    } catch (failure: any) {
      if (alive.current) {
        if ([403, 404].includes(failure.response?.status)) { setData(null); setDraft(null); }
        setError(operationError(failure));
      }
    }
    finally { if (alive.current) setMoreLoading(false); }
  }

  return <section className="tutor-compensation" aria-label="Tutor compensation">
    <header className="compensation-header"><h2>Compensation</h2><IconButton icon="refresh" title="Reload compensation" disabled={loading || saving || moreLoading} onClick={load} /></header>
    {error && <p className="operations-error" role="alert">{error}</p>}
    {success && <p className="compensation-success" role="status">{success}</p>}
    {loading && <p role="status">Loading compensation...</p>}
    {data && <>
      <div className="compensation-editor">
        <dl className="compensation-summary">
          <div className="compensation-current"><dt>USD per completed lesson</dt><dd className={data.compensation.baseRateCents === null ? 'compensation-unset' : ''}>{usdRateLabel(data.compensation.baseRateCents)}</dd></div>
          <div><dt>Last changed</dt><dd>{dateText(data.compensation.updatedAt)}</dd></div>
          <div><dt>Changed by</dt><dd>{data.compensation.updatedByName || '-'}</dd></div>
        </dl>
        <form onSubmit={preview}>
          <fieldset disabled={loading || saving || moreLoading || conflict}>
            <label for="tutor-base-rate">Base rate per completed lesson</label>
            <div className="compensation-amount"><span>USD</span><input id="tutor-base-rate" type="text" inputMode="decimal" autoComplete="off" required maxLength={12}
              value={amount} onInput={event => setAmount(event.currentTarget.value)} placeholder="0.00" /></div>
            <label for="tutor-rate-reason">{data.compensation.version > 0 ? 'Change reason' : 'Reason (optional)'}</label>
            <textarea id="tutor-rate-reason" rows={3} required={data.compensation.version > 0} maxLength={1000} value={reason} onInput={event => setReason(event.currentTarget.value)} />
            <button type="submit" className="operations-primary compensation-save"><i aria-hidden="true" className="ri-save-3-line" />Save rate</button>
          </fieldset>
        </form>
      </div>
      <div className="compensation-history"><h3>Rate history</h3>
        {data.history.length ? <div className="operations-table-wrap"><table><thead><tr><th>Changed (PHT)</th><th>Administrator</th><th>Previous USD rate</th><th>New USD rate</th><th>Reason</th></tr></thead>
          <tbody>{data.history.map(item => <tr key={item.id}><td>{dateText(item.changedAt)}</td><td>{item.changedByName}</td><td>{usdRateLabel(item.previousRateCents)}</td><td>{usdRateLabel(item.baseRateCents)}</td><td className="compensation-reason">{item.reason}</td></tr>)}</tbody>
        </table></div> : <p>No rate changes recorded.</p>}
        {data.nextHistoryBeforeVersion !== null && <button type="button" disabled={loading || saving || moreLoading} onClick={more}><i aria-hidden="true" className="ri-arrow-down-line" />{moreLoading ? 'Loading...' : 'Earlier changes'}</button>}
      </div>
    </>}
    {draft && data && <RateConfirmation draft={draft} previous={data.compensation.baseRateCents} busy={saving} error={saveError} onClose={() => setDraft(null)} onConfirm={confirm} />}
  </section>;
}
