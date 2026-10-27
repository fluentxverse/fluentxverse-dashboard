import { apiClient } from './apiClient';
import type { ContainerStats } from '../../../shared/containerStats';

export async function getContainerStats(signal: AbortSignal): Promise<ContainerStats> {
  const { data } = await apiClient.get('/admin/container-stats', { signal, timeout: 12000 });
  if (!data?.success || !data.data) throw new Error('Container monitoring is unavailable.');
  return data.data;
}
