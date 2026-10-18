import { apiClient } from './apiClient';
export const operationError = (error: any) => error.response?.data?.error || error.message || 'Request failed';
export async function operations(path: string, method = 'get', body?: any) {
  const { data } = await apiClient.request({ url: `/admin/operations${path}`, method, data: body });
  if (!data.success) throw new Error(data.error || 'Request failed');
  return data.data;
}
export async function attendanceOperation(path: string, method: string, body: any) {
  const { data } = await apiClient.request({ url: `/lesson-workflow/admin/attendance${path}`, method, data: body });
  if (!data.success) throw new Error(data.error || 'Request failed');
}
