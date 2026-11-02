import { useEffect, useState } from 'preact/hooks';
import { apiClient } from '../api/apiClient';
import './BookingSettings.css';

interface Settings { mode: 'trial' | 'paid'; trialLessonLimit: number; revision: number; updatedAt: string | null }
export function BookingSettings() {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [mode, setMode] = useState<'trial' | 'paid'>('paid');
  const [limit, setLimit] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = async () => {
    setBusy(true); setError(''); setSuccess('');
    try {
      const { data } = await apiClient.get('/admin/booking-settings', { headers: { 'Cache-Control': 'no-store' } });
      if (!data.success) throw new Error(data.error || 'Could not load booking settings.');
      setSaved(data.data); setMode(data.data.mode); setLimit(String(data.data.trialLessonLimit));
    } catch (e: any) { setError(e.response?.data?.error || e.message || 'Could not load booking settings.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  const save = async (event: Event) => {
    event.preventDefault(); if (!saved || busy) return;
    setError(''); setSuccess('');
    const count = Number(limit);
    if (!Number.isInteger(count) || count < 1 || count > 999) { setError('Enter a whole number between 1 and 999.'); return; }
    setBusy(true);
    try {
      const { data } = await apiClient.put('/admin/booking-settings', { mode, trialLessonLimit: count, revision: saved.revision });
      if (!data.success) throw new Error(data.error || 'Could not save booking settings.');
      setSaved(data.data); setSuccess(mode === 'trial' ? 'Free-trial booking is enabled.' : 'Paid booking is enabled.');
    } catch (e: any) { setError(e.response?.data?.error || e.message || 'Could not save booking settings.'); }
    finally { setBusy(false); }
  };
  return <section class="booking-settings" id="lesson-booking" aria-labelledby="lesson-booking-title">
    <div class="booking-settings-heading"><i class="ri-calendar-check-line" aria-hidden="true"/><h2 id="lesson-booking-title">Lesson Booking</h2></div>
    {busy && !saved && <p role="status">Loading booking settings...</p>}
    {error && <p role="alert" class="booking-settings-error">{error}</p>}
    {success && <p role="status" class="booking-settings-success">{success}</p>}
    {saved && <form onSubmit={save}>
      <p>Current mode: <strong>{saved.mode === 'trial' ? 'Free trial' : 'Paid bookings'}</strong></p>
      <fieldset disabled={busy} class="booking-mode-options"><legend>Booking mode</legend>
        <label><input type="radio" name="booking-mode" checked={mode === 'trial'} onChange={() => { setMode('trial'); setSuccess(''); }}/><span>Free trial</span></label>
        <label><input type="radio" name="booking-mode" checked={mode === 'paid'} onChange={() => { setMode('paid'); setSuccess(''); }}/><span>Paid bookings</span></label>
      </fieldset>
      <label class="booking-limit-label" for="trial-limit">Free trials per student</label>
      <input id="trial-limit" type="number" min="1" max="999" step="1" required disabled={busy} value={limit} onInput={e => { setLimit(e.currentTarget.value); setSuccess(''); }}/>
      <p class="booking-settings-note">Trial limits include lessons already used or reserved. Existing bookings and ticket balances are not changed. Paid bookings also require the student ticketing interface to be enabled.</p>
      {saved.updatedAt && <p class="booking-settings-note">Last updated: {new Date(saved.updatedAt).toLocaleString()}</p>}
      <div class="booking-settings-actions">
        <button type="submit" class="btn-primary" disabled={busy || (saved.mode === mode && saved.trialLessonLimit === Number(limit))}><i class={busy ? 'ri-loader-4-line spinning' : 'ri-save-line'} aria-hidden="true"/>{busy ? 'Saving...' : 'Save booking settings'}</button>
        <button type="button" disabled={busy} onClick={() => void load()}><i class="ri-refresh-line" aria-hidden="true"/>Reload</button>
      </div>
    </form>}
    {!saved && !busy && <button type="button" onClick={() => void load()}><i class="ri-refresh-line" aria-hidden="true"/>Retry</button>}
  </section>;
}
