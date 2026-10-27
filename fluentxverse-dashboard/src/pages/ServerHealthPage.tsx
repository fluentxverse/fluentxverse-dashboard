import { useEffect, useRef, useState } from 'preact/hooks';
import type { HostCapacity, ServerHealth } from '../../../shared/serverHealth';
import { getServerHealth } from '../api/serverHealth.api';
import './ServerHealthPage.css';
import { formatBytes } from '../utils/metricFormat';

function uptime(seconds: number): string {
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return `${days ? `${days}d ` : ''}${hours}h ${minutes}m`;
}

function Capacity({ title, icon, data }: { title: string; icon: string; data: HostCapacity }) {
  const percent = data.usedBytes / data.totalBytes * 100;
  return <section className="sh-metric" aria-label={title}>
    <div className="sh-metric-heading"><h2><i className={icon} aria-hidden="true" />{title}</h2><strong>{percent.toFixed(1)}<small>%</small></strong></div>
    <progress className={percent > 85 ? 'sh-high' : ''} max="100" value={percent} aria-label={`${title} used`} />
    <div className="sh-pair"><span>{formatBytes(data.usedBytes)} / {formatBytes(data.totalBytes)}</span><span>{formatBytes(data.availableBytes)} available</span></div>
  </section>;
}

export default function ServerHealthPage() {
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [automatic, setAutomatic] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const request = useRef<AbortController | null>(null);
  const refresh = useRef<() => void>(() => {});

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      if (request.current || document.hidden) return;
      const controller = new AbortController(); request.current = controller;
      setLoading(true);
      try {
        const result = await getServerHealth(controller.signal);
        if (!disposed) { setHealth(result); setError(''); setForbidden(false); setClock(Date.now()); }
      } catch (err: any) {
        if (!disposed && !controller.signal.aborted) {
          const denied = err?.response?.status === 403;
          setForbidden(denied);
          if (denied || err?.response?.status === 401) { setHealth(null); setAutomatic(false); }
          setError(denied ? 'Operations permission required.' : 'Unable to refresh host metrics.');
        }
      } finally {
        if (!disposed) setLoading(false);
        if (request.current === controller) request.current = null;
      }
    };
    refresh.current = load;
    load();
    const timer = window.setInterval(() => {
      setClock(Date.now());
      if (automatic && !forbidden) load();
    }, 5000);
    const visible = () => { if (document.hidden) request.current?.abort(); else if (automatic && !forbidden) load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', visible); request.current?.abort(); request.current = null; };
  }, [automatic, forbidden]);

  const snapshot = health?.snapshot;
  const age = snapshot ? Math.max(health?.ageSeconds || 0, (clock - Date.parse(snapshot.sampledAt)) / 1000) : 0;
  const stale = Boolean(snapshot && (health?.status === 'stale' || age > 30 || error));
  return <div className="server-health-page">
    <div className="sh-toolbar">
      <div><h1>Server Health</h1><div className="sh-status"><span className={`sh-dot ${snapshot && !stale ? 'sh-online' : ''}`} /><span>{snapshot ? stale ? 'Stale readings' : automatic ? 'Live host metrics' : 'Updates paused' : 'Waiting for host'}</span></div></div>
      <div className="sh-controls"><label><input type="checkbox" checked={automatic} onChange={event => setAutomatic(event.currentTarget.checked)} />Auto-refresh</label><button type="button" title="Refresh metrics" aria-label="Refresh metrics" onClick={() => refresh.current()} disabled={loading || forbidden}><i className={`ri-refresh-line ${loading ? 'sh-spinning' : ''}`} aria-hidden="true" /></button></div>
    </div>
    {error && <div className="sh-alert" role="alert"><i className="ri-error-warning-line" aria-hidden="true" />{error}{health && ' Last successful readings are shown.'}</div>}
    {!snapshot ? <div className="sh-empty" role="status"><i className={forbidden ? 'ri-shield-keyhole-line' : 'ri-server-line'} aria-hidden="true" /><h2>{forbidden ? 'Restricted access' : loading ? 'Loading host metrics' : 'Monitoring unavailable'}</h2></div> : <>
      <div className="sh-host"><span><i className="ri-server-line" aria-hidden="true" />{snapshot.hostname}</span><span>Primary cloud server</span><span>Uptime {uptime(snapshot.uptimeSeconds)}</span></div>
      <div className="sh-metrics">
        <Capacity title="Memory" icon="ri-ram-line" data={snapshot.memory} />
        <section className="sh-metric" aria-label="CPU">
          <div className="sh-metric-heading"><h2><i className="ri-cpu-line" aria-hidden="true" />CPU</h2><strong>{snapshot.cpu.usagePercent === null ? '--' : snapshot.cpu.usagePercent.toFixed(1)}<small>%</small></strong></div>
          <progress max="100" value={snapshot.cpu.usagePercent ?? undefined} aria-label="CPU usage" className={snapshot.cpu.usagePercent === null ? 'sh-pending' : snapshot.cpu.usagePercent > 85 ? 'sh-high' : ''} />
          <div className="sh-pair"><span>{snapshot.cpu.model}</span><span>{snapshot.cpu.cores} {snapshot.cpu.cores === 1 ? 'vCPU' : 'vCPUs'}</span></div>
        </section>
        <Capacity title="Disk" icon="ri-hard-drive-3-line" data={snapshot.disk} />
      </div>
      <section className="sh-network" aria-labelledby="sh-network-heading">
        <div className="sh-section-heading"><h2 id="sh-network-heading"><i className="ri-global-line" aria-hidden="true" />Network</h2><span className="sh-interface">{snapshot.network.interface}</span></div>
        <div className="sh-addresses">{snapshot.network.addresses.map(address => <code key={address}>{address}</code>)}</div>
        <div className="sh-network-grid">
          <div className="sh-network-total"><span>Transferred</span><strong>{formatBytes(snapshot.network.receivedBytes + snapshot.network.sentBytes)}</strong><small>Interface counters; reset on reboot or interface reset</small></div>
          <dl className="sh-data-list"><div><dt><span className="sh-key sh-in" />Inbound</dt><dd>{formatBytes(snapshot.network.receivedBytes)}</dd></div><div><dt><span className="sh-key sh-out" />Outbound</dt><dd>{formatBytes(snapshot.network.sentBytes)}</dd></div><div><dt>Plan allowance / month</dt><dd>{formatBytes(snapshot.bandwidth.allowanceBytes)}</dd></div></dl>
          <dl className="sh-data-list"><div><dt>Inbound speed</dt><dd>{snapshot.network.receiveBytesPerSecond === null ? 'Sampling...' : formatBytes(snapshot.network.receiveBytesPerSecond, true)}</dd></div><div><dt>Outbound speed</dt><dd>{snapshot.network.sendBytesPerSecond === null ? 'Sampling...' : formatBytes(snapshot.network.sendBytesPerSecond, true)}</dd></div><div><dt>Provider billing usage</dt><dd className="sh-unavailable">Not connected</dd></div></dl>
        </div>
      </section>
      <footer className="sh-footer"><span>Host sample <time dateTime={snapshot.sampledAt}>{new Date(snapshot.sampledAt).toLocaleString()}</time></span><span>{Math.max(0, Math.floor(age))}s ago{stale && ' / stale'}</span></footer>
    </>}
  </div>;
}
