import { apiClient } from './apiClient';

export type AdminTaskStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';
export type AdminTaskKind = 'task' | 'suggestion';

export interface AdminTask {
  id: string;
  title: string;
  description: string;
  kind: AdminTaskKind;
  status: AdminTaskStatus;
  created_by: string;
  assignee_id: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskAssignee {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const unwrap = <T,>(result: ApiResult<T>): T => {
  if (!result.success || result.data === undefined) throw new Error(result.error || 'Request failed');
  return result.data;
};

export const adminTasksApi = {
  async list(): Promise<AdminTask[]> {
    const response = await apiClient.get<ApiResult<AdminTask[]>>('/admin/tasks', { timeout: 12000 });
    return unwrap(response.data);
  },
  async assignees(): Promise<TaskAssignee[]> {
    const response = await apiClient.get<ApiResult<TaskAssignee[]>>('/admin/tasks/assignees', { timeout: 12000 });
    return unwrap(response.data);
  },
  async create(input: { title: string; description: string; kind: AdminTaskKind; assigneeId: string }): Promise<AdminTask> {
    const response = await apiClient.post<ApiResult<AdminTask>>('/admin/tasks', input);
    return unwrap(response.data);
  },
  async updateStatus(id: string, status: AdminTaskStatus): Promise<AdminTask> {
    const response = await apiClient.patch<ApiResult<AdminTask>>(`/admin/tasks/${id}/status`, { status });
    return unwrap(response.data);
  },
  async assign(id: string, assigneeId: string): Promise<AdminTask> {
    const response = await apiClient.patch<ApiResult<AdminTask>>(`/admin/tasks/${id}/assignee`, { assigneeId });
    return unwrap(response.data);
  },
};
