import { apiClient } from './apiClient';
import type { ServerHealth } from '../../../shared/serverHealth';

export async function getServerHealth(signal: AbortSignal): Promise<ServerHealth> {
  const { data } = await apiClient.get('/admin/server-health', { signal, timeout: 12000 });
  if (!data?.success || !data.data) throw new Error('Host monitoring is unavailable.');
  return data.data;
}
