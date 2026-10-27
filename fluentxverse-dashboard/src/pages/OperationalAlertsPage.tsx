import { useEffect, useRef, useState } from 'preact/hooks';
import { acknowledgeOperationalAlert, ALERT_AVAILABILITY_URL, getOperationalAlerts } from '../api/operationalAlerts.api';
import type { AlertSnapshot, OperationalIncident } from '../../../shared/operationalAlerts';
import './OperationalAlertsPage.css';

const categories = { availability: 'API availability', disk: 'Disk capacity', containers: 'Containers', recordings: 'Recording archives', proofs: 'Proof workflows', monitoring: 'Telemetry' };
const timestamp = (value: string) => new Date(value).toLocaleString();

export default function OperationalAlertsPage() {
  const [data, setData] = useState<AlertSnapshot | null>(null);
  const [error, setError] = useState('');
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active');
  const [category, setCategory] = useState('');
  const [severity, setSeverity] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [notify, setNotify] = useState(() => { try { return localStorage.getItem('fxv_ops_notifications') === 'true'; } catch { return false; } });
  const [notice, setNotice] = useState('');
  const [availability, setAvailability] = useState<{ apiAvailable: boolean | null; checkedAt: string | null; incidentActive: boolean } | null>(null);
  const outageNotified = useRef(false);
  const seen = useRef(new Map<string, string>()), initialized = useRef(false), notifyRef = useRef(notify);
  const refresh = useRef<() => void>(() => {});
  notifyRef.current = notify;
  useEffect(() => {
    let disposed = false, blocked = false, inFlight = false;
    const controller = new AbortController();
    const load = async () => {
      const backgroundNotifications = notifyRef.current && 'Notification' in window && Notification.permission === 'granted';
      if (blocked || inFlight || disposed || document.hidden && !backgroundNotifications) return;
      inFlight = true; setLoading(true);
      try {
        const current = await getOperationalAlerts(controller.signal);
        if (!disposed) {
          setData(current); setError(''); setClock(Date.now());
          setAvailability(null); outageNotified.current = false;
          for (const incident of current.incidents) {
            const marker = `${incident.severity}:${incident.resolvedAt || 'open'}`;
            if (initialized.current && seen.current.get(incident.id) !== marker) {
              if (notifyRef.current && 'Notification' in window && Notification.permission === 'granted') {
                try { const n = new Notification(incident.resolvedAt ? 'Operational incident recovered' : incident.title,
                  { body: incident.resolvedAt ? incident.title : incident.message, tag: `fxv-ops-${incident.id}` });
                  n.onclick = () => { window.focus(); window.location.assign('/alerts'); n.close(); };
                } catch { /* Some mobile browsers require service-worker notifications. */ }
              }
            }
            seen.current.set(incident.id, marker);
          }
          initialized.current = true;
        }
      } catch (err: any) {
        if (!disposed && !controller.signal.aborted) {
          if ([401, 403].includes(err?.response?.status)) { blocked = true; setDenied(true); setData(null); setAvailability(null); }
          setError(err?.response?.status === 403 ? 'Operations permission required.' : 'Cannot refresh alerts. Last successful incident records may be out of date.');
          if (!blocked) try {
            const r = await fetch(ALERT_AVAILABILITY_URL, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
            if (r.ok && !disposed) {
              const status = await r.json(); setAvailability(status);
              if (status.incidentActive && status.apiAvailable === false && status.checkedAt && Date.now() - Date.parse(status.checkedAt) < 180000
                && !outageNotified.current && notifyRef.current && 'Notification' in window && Notification.permission === 'granted') {
                try { new Notification('FluentXVerse API is unavailable', { body: 'The independent watchdog confirmed repeated API health failures.', tag: 'fxv-api-availability' }); outageNotified.current = true; } catch {}
              }
            }
          } catch { if (!disposed) setAvailability(null); }
        }
      } finally { if (!disposed) setLoading(false); inFlight = false; }
    };
    refresh.current = load; void load();
    const timer = setInterval(() => { setClock(Date.now()); void load(); }, 30000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);

  async function toggleNotifications(enabled: boolean) {
    setNotice('');
    if (enabled) {
      if (!('Notification' in window)) { setNotice('Browser notifications are not supported on this device.'); return; }
      try { if (await Notification.requestPermission() !== 'granted') { setNotice('Notifications were not allowed. Update this site’s browser permissions to enable them.'); return; } }
      catch { setNotice('Notifications could not be enabled on this device.'); return; }
    }
    setNotify(enabled); try { localStorage.setItem('fxv_ops_notifications', String(enabled)); } catch {}
  }
  async function acknowledge(incident: OperationalIncident) {
    if (busy) return; setBusy(incident.id); setNotice('');
    try { setData(await acknowledgeOperationalAlert(incident.id)); }
    catch { setNotice('Acknowledgement was not saved. Refresh and try again.'); }
    finally { setBusy(''); }
  }
  const all = data?.incidents || [], active = all.filter(i => !i.resolvedAt);
  const stale = !data?.checkedAt || clock - Date.parse(data.checkedAt) > 180000;
  const rows = all.filter(i => (filter === 'all' || (filter === 'recovered' ? !!i.resolvedAt : filter === 'acknowledged' ? !i.resolvedAt && !!i.acknowledgedAt : !i.resolvedAt))
    && (!category || i.category === category) && (!severity || i.severity === severity)
    && `${i.id} ${i.title} ${i.message}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="ops-alerts-page">
    <header className="oa-toolbar"><div><h1>Alerts</h1><p>{denied ? 'Restricted access' : stale ? 'Monitoring status needs attention' : 'External watchdog active'}</p></div>
      <div className="oa-controls"><label><input type="checkbox" checked={notify} disabled={denied} onChange={e => void toggleNotifications(e.currentTarget.checked)} />Browser notifications</label>
        <button type="button" title="Refresh alerts" aria-label="Refresh alerts" disabled={loading || denied} onClick={() => refresh.current()}><i className="ri-refresh-line" aria-hidden="true" /></button></div></header>
    {error && <div className="oa-banner oa-warning" role="alert">{error}</div>}
    {availability && <div className="oa-banner" role="status">External availability check: {availability.checkedAt && Date.now() - Date.parse(availability.checkedAt) < 180000 && availability.apiAvailable !== null ? availability.apiAvailable === false ? 'API is unavailable' : 'API responded; incident records are unavailable' : 'watchdog readings are stale or unavailable'}.</div>}
    {notice && <div className="oa-banner" role="status">{notice}</div>}
    {denied ? <div className="oa-empty"><i className="ri-shield-keyhole-line" aria-hidden="true" /><h2>Operations access required</h2></div> : !data ? <div className="oa-empty" role="status"><h2>{loading ? 'Loading alerts' : 'Alert monitor unavailable'}</h2></div> : <>
      {stale && <div className="oa-banner oa-warning" role="alert">The watchdog has not checked in within 3 minutes. A quiet incident list does not establish that services are healthy.</div>}
      <div className="oa-summary"><span><b>{active.length}</b> Active</span><span className="oa-critical-text"><b>{active.filter(i => i.severity === 'critical').length}</b> Critical</span><span><b>{active.filter(i => i.acknowledgedAt).length}</b> Acknowledged</span><span><b>{all.filter(i => i.resolvedAt).length}</b> Recovered</span></div>
      <div className="oa-filters"><div className="oa-tabs" role="group" aria-label="Incident status">{[['active','Active'],['acknowledged','Acknowledged'],['recovered','Recovered'],['all','All']].map(([key,label]) => <button type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>)}</div>
        <div className="oa-search"><i className="ri-search-line" aria-hidden="true" /><input type="search" aria-label="Search incidents" placeholder="Search incidents or ID" value={search} onInput={e => setSearch(e.currentTarget.value)} /></div>
        <select aria-label="Alert category" value={category} onChange={e => setCategory(e.currentTarget.value)}><option value="">All categories</option>{Object.entries(categories).map(([key,label]) => <option value={key}>{label}</option>)}</select>
        <select aria-label="Alert severity" value={severity} onChange={e => setSeverity(e.currentTarget.value)}><option value="">All severities</option><option value="critical">Critical</option><option value="warning">Warning</option></select></div>
      <div className="oa-incidents">{rows.length ? rows.map(i => <article className={`oa-incident ${i.resolvedAt ? 'oa-resolved' : ''}`} key={i.id}>
        <div className="oa-incident-main"><div className="oa-labels"><span className={`oa-severity oa-${i.severity}`}>{i.severity}</span><span>{categories[i.category]}</span><span>{i.resolvedAt ? 'Recovered' : i.acknowledgedAt ? 'Acknowledged' : 'Needs attention'}</span></div>
          <h2>{i.title}</h2><p>{i.message}</p><div className="oa-times"><span>Opened {timestamp(i.openedAt)}</span><span>{i.resolvedAt ? `Recovered ${timestamp(i.resolvedAt)}` : `Last observed ${timestamp(i.lastSeenAt)}`}</span></div>
          <code title={i.id}>{i.id}</code><details><summary>Incident history</summary><ol>{i.events.map(event => <li><time dateTime={event.at}>{timestamp(event.at)}</time><span>{event.action}{event.actor ? ` by ${event.actor}` : ''}</span></li>)}</ol></details>
        </div><div className="oa-actions">{!i.resolvedAt && !i.acknowledgedAt && <button type="button" disabled={!!busy} onClick={() => void acknowledge(i)}><i className="ri-check-line" aria-hidden="true" />{busy === i.id ? 'Saving...' : 'Acknowledge'}</button>}
          <a href={i.href}><i className="ri-arrow-right-line" aria-hidden="true" />{i.href === '/alerts' ? 'Proof alert details' : 'Investigate'}</a></div>
      </article>) : <div className="oa-empty" role="status"><i className={active.length ? 'ri-filter-line' : 'ri-checkbox-circle-line'} aria-hidden="true" /><h2>{filter === 'active' && !search && !category && !severity ? 'No active incidents' : 'No matching incidents'}</h2></div>}</div>
      <footer className="oa-footer"><span>Last check: {data.checkedAt ? timestamp(data.checkedAt) : 'Not received'}</span><span>Browser notifications require this page to be open. External delivery is not configured.</span></footer>
      <details className="oa-rules"><summary>Alert thresholds</summary><ul><li>API: 3 consecutive failed one-minute checks; recovers after 2 healthy checks.</li><li>Disk: warning at 85%; critical at 95% or less than 1 GiB available. Recovers below 80% with at least 1 GiB available.</li><li>Containers: required service missing, stopped or unhealthy; or at least 3 restarts within 10 minutes. Container replacements establish a new baseline.</li><li>Recordings: archive error, at least 3 retries, or uploaded but not archived after 30 minutes.</li><li>Proofs: application workflows pending for 30 minutes. Records without timestamps use first-observed queue age. This does not monitor manual Engine submissions.</li><li>Other rules need 2 failing checks to open and 2 healthy checks to recover. Missing data does not resolve incidents. History keeps up to 200 incidents for 90 days.</li></ul></details>
    </>}
  </div>;
}
