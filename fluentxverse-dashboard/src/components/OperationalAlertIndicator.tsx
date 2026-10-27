import { useEffect, useState } from 'preact/hooks';
import { getOperationalAlerts } from '../api/operationalAlerts.api';
import './OperationalAlertIndicator.css';

export function OperationalAlertIndicator() {
  const [count, setCount] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let disposed = false, denied = false, busy = false;
    const controller = new AbortController();
    const load = async () => {
      if (denied || busy || disposed || document.hidden) return;
      busy = true;
      try {
        const data = await getOperationalAlerts(controller.signal);
        if (!disposed) {
          setCount(data.incidents.filter(i => !i.resolvedAt && !i.acknowledgedAt).length);
          setStale(!data.checkedAt || Date.now() - Date.parse(data.checkedAt) > 180000);
        }
      } catch (error: any) {
        if (!disposed) {
          if ([401, 403].includes(error?.response?.status)) { denied = true; setCount(null); }
          else { setStale(true); }
        }
      } finally { busy = false; }
    };
    void load(); const timer = setInterval(load, 30000);
    return () => { disposed = true; controller.abort(); clearInterval(timer); };
  }, []);
  if (count === null) return null;
  return <a className={`header-btn ops-alert-indicator ${stale ? 'ops-alert-stale' : count ? 'ops-alert-active' : ''}`} href="/alerts"
    title={stale ? 'Alerts need a refresh' : `${count} unacknowledged operational alerts`} aria-label={stale ? 'Operational alerts status unavailable' : `Operational alerts: ${count} unacknowledged`}>
    <i className="ri-alarm-warning-line" aria-hidden="true" />{(count > 0 || stale) && <span>{stale ? '!' : count > 99 ? '99+' : count}</span>}
  </a>;
}
