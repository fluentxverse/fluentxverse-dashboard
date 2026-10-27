import { apiClient } from './apiClient';
import type { AlertSnapshot } from '../../../shared/operationalAlerts';
export const ALERT_AVAILABILITY_URL = 'https://fluentxverse-alerts.paulanthonyarriola.workers.dev/availability';
export async function getOperationalAlerts(signal?: AbortSignal): Promise<AlertSnapshot> {
  const { data } = await apiClient.get('/admin/alerts', { signal, timeout: 12000 });
  if (!data?.success || data.data?.version !== 1 || !Array.isArray(data.data.incidents)) throw Error('Alerts unavailable');
  return data.data;
}
export async function acknowledgeOperationalAlert(id: string): Promise<AlertSnapshot> {
  const { data } = await apiClient.post(`/admin/alerts/${encodeURIComponent(id)}/acknowledge`, {}, { timeout: 12000 });
  if (!data?.success || data.data?.version !== 1) throw Error('Acknowledgement failed');
  return data.data;
}
