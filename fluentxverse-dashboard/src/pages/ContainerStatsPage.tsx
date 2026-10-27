import { useEffect, useRef, useState } from 'preact/hooks';
import type { ContainerRow, ContainerStats } from '../../../shared/containerStats';
import { getContainerStats } from '../api/containerStats.api';
import { formatBytes } from '../utils/metricFormat';
import './ContainerStatsPage.css';

type Sort = 'name' | 'cpu' | 'memory' | 'pids';
const percent = (value: number | null) => value === null ? '--' : `${value.toFixed(2)}%`;
function sortValue(row: ContainerRow, column: Sort): number | string {
  if (column === 'name') return row.name;
  if (!row.metrics) return -1;
  return column === 'cpu' ? row.metrics.cpuPercent ?? -1 : column === 'memory' ? row.metrics.memoryBytes : row.metrics.pids;
}

export default function ContainerStatsPage() {
  const [data, setData] = useState<ContainerStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [automatic, setAutomatic] = useState(true);
  const [clock, setClock] = useState(Date.now());
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<Sort>('name');
  const [descending, setDescending] = useState(false);
  const poll = useRef(true), denied = useRef(false), refresh = useRef<() => void>(() => {});
  poll.current = automatic;
  useEffect(() => {
    let disposed = false, controller: AbortController | null = null;
    const load = async () => {
      if (controller || disposed || denied.current || document.hidden) return;
      const current = new AbortController(); controller = current; setLoading(true);
      try {
        const result = await getContainerStats(current.signal);
        if (!disposed) { setData(result); setError(''); setClock(Date.now()); }
      } catch (err: any) {
        if (!disposed && !current.signal.aborted) {
          const status = err?.response?.status;
          if (status === 401 || status === 403) { setData(null); setAutomatic(false); setBlocked(true); denied.current = true; }
          setError(status === 403 ? 'Operations permission required.' : status === 401 ? 'Authentication required.' : 'Unable to refresh container statistics.');
        }
      } finally { if (!disposed) setLoading(false); if (controller === current) controller = null; }
    };
    refresh.current = load;
    load();
    const timer = window.setInterval(() => { setClock(Date.now()); if (poll.current) load(); }, 5000);
    const visible = () => { if (document.hidden) controller?.abort(); else if (poll.current) load(); };
    document.addEventListener('visibilitychange', visible);
    return () => { disposed = true; clearInterval(timer); controller?.abort(); document.removeEventListener('visibilitychange', visible); };
  }, []);

  const snapshot = data?.snapshot, all = snapshot?.containers || [];
  const running = all.filter(row => row.state === 'running').length;
  const unavailable = all.filter(row => ['running', 'paused'].includes(row.state) && !row.metrics).length;
  const age = snapshot ? Math.max(data?.ageSeconds || 0, (clock - Date.parse(snapshot.sampledAt)) / 1000) : 0;
  const stale = Boolean(snapshot && (data?.status === 'stale' || age > 30 || error));
  const rows = all.filter(row => (!search || `${row.name} ${row.id}`.toLowerCase().includes(search.toLowerCase())) && (filter === 'all' || (filter === 'running' ? row.state === 'running' : row.state !== 'running')))
    .sort((a, b) => { const left = sortValue(a, sort), right = sortValue(b, sort); const result = typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : Number(left) - Number(right); return (descending ? -result : result) || a.name.localeCompare(b.name); });
  const heading = (label: string, column: Sort) => <th scope="col" aria-sort={sort === column ? descending ? 'descending' : 'ascending' : 'none'}><button type="button" title={`Sort by ${label}`} onClick={() => { setSort(column); setDescending(sort === column ? !descending : column !== 'name'); }}>{label}<i aria-hidden="true" className={sort === column ? descending ? 'ri-arrow-down-s-line' : 'ri-arrow-up-s-line' : 'ri-arrow-up-down-line'} /></button></th>;

  return <div className="container-stats-page">
    <header className="cs-toolbar"><div><h1>Stats</h1><div className="cs-status"><span className={snapshot && !stale ? 'cs-live' : ''} />{snapshot ? stale ? 'Stale readings' : !automatic ? 'Updates paused' : data?.status === 'partial' ? 'Partial readings' : 'Live container stats' : 'Waiting for Docker'}</div></div><div className="cs-controls"><label><input type="checkbox" checked={automatic} disabled={blocked} onChange={event => { setAutomatic(event.currentTarget.checked); if (event.currentTarget.checked) refresh.current(); }} />Auto-refresh</label><button type="button" className="cs-icon-button" title="Refresh container statistics" aria-label="Refresh container statistics" disabled={loading || blocked} onClick={() => refresh.current()}><i className={`ri-refresh-line ${loading ? 'cs-spinning' : ''}`} aria-hidden="true" /></button></div></header>
    {error && <div className="cs-alert" role="alert">{error}{snapshot && ' Last successful readings are shown.'}</div>}
    {!snapshot ? <div className="cs-empty" role="status"><i className={blocked ? 'ri-shield-keyhole-line' : 'ri-server-line'} aria-hidden="true" /><h2>{blocked ? 'Restricted access' : loading ? 'Loading container statistics' : 'Monitoring unavailable'}</h2></div> : <>
      <div className="cs-summary"><span><i className="ri-server-line" aria-hidden="true" />{snapshot.hostname}</span><span><b>{all.length}</b> containers</span><span className="cs-running"><b>{running}</b> running</span><span><b>{all.length - running}</b> not running</span>{unavailable > 0 && <span className="cs-warning">{unavailable} metrics unavailable</span>}</div>
      <div className="cs-filters"><div className="cs-search"><i className="ri-search-line" aria-hidden="true" /><input type="search" aria-label="Search containers" placeholder="Search name or ID" value={search} onInput={event => setSearch(event.currentTarget.value)} /></div><select aria-label="Container state" value={filter} onChange={event => setFilter(event.currentTarget.value)}><option value="all">All containers</option><option value="running">Running</option><option value="stopped">Not running</option></select><select className="cs-mobile-sort" aria-label="Sort containers" value={sort} onChange={event => { const column = event.currentTarget.value as Sort; setSort(column); setDescending(column !== 'name'); }}><option value="name">Name</option><option value="cpu">Highest CPU</option><option value="memory">Highest memory</option><option value="pids">Most PIDs</option></select><span>{rows.length} shown</span></div>
      {all.length === 0 ? <div className="cs-empty" role="status"><h2>No containers</h2></div> : rows.length === 0 ? <div className="cs-empty" role="status"><h2>No matching containers</h2><button type="button" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button></div> : <div className="cs-table-wrap"><table className="cs-table"><caption className="cs-sr-only">Docker container resource statistics on {snapshot.hostname}</caption><thead><tr>{heading('Container', 'name')}<th scope="col">State</th>{heading('CPU', 'cpu')}{heading('Memory / Limit', 'memory')}<th scope="col">Network I/O<small>Received / Sent</small></th><th scope="col">Block I/O<small>Read / Written</small></th>{heading('PIDs', 'pids')}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>
        <td className="cs-container" data-label="Container"><strong>{row.name}</strong><code>{row.id.slice(0, 12)}</code><small>{row.status}</small></td>
        <td data-label="State"><span className={`cs-state cs-state-${row.state}`}>{row.state}</span>{['running', 'paused'].includes(row.state) && !row.metrics && <small className="cs-warning">Metrics unavailable</small>}</td>
        <td data-label="CPU" className="cs-number">{row.metrics ? percent(row.metrics.cpuPercent) : '--'}</td>
        <td data-label="Memory / Limit" className="cs-memory">{row.metrics ? <><span>{formatBytes(row.metrics.memoryBytes)} / {formatBytes(row.metrics.memoryLimitBytes)}</span><div><progress max="100" value={Math.min(100, row.metrics.memoryBytes / row.metrics.memoryLimitBytes * 100)} aria-label={`${row.name} memory usage`} /><small>{percent(row.metrics.memoryBytes / row.metrics.memoryLimitBytes * 100)}</small></div></> : '--'}</td>
        <td data-label="Network: RX / TX" className="cs-number">{row.metrics ? <span className="cs-io">{formatBytes(row.metrics.receivedBytes)}<span className="cs-divider">/</span>{formatBytes(row.metrics.sentBytes)}</span> : '--'}</td>
        <td data-label="Block: Read / Write" className="cs-number">{row.metrics ? <span className="cs-io">{formatBytes(row.metrics.blockReadBytes)}<span className="cs-divider">/</span>{formatBytes(row.metrics.blockWrittenBytes)}</span> : '--'}</td>
        <td data-label="PIDs" className="cs-number">{row.metrics?.pids.toLocaleString() ?? '--'}</td>
      </tr>)}</tbody></table></div>}
      <footer className="cs-footer"><span>Primary cloud server / cumulative I/O counters</span><span><time dateTime={snapshot.sampledAt}>{new Date(snapshot.sampledAt).toLocaleString()}</time> / {Math.max(0, Math.floor(age))}s ago{stale && ' / stale'}</span></footer>
    </>}
  </div>;
}
