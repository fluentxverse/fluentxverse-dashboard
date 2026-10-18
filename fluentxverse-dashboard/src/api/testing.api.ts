import { apiClient } from './apiClient';

export interface TestingItem {
  id: string; category: string; title: string; steps: string; expected: string; gate?: string;
  completed: boolean; notes: string; revision: number; updatedBy: string | null; updatedAt: string | null;
}
export interface TestingProgress { runId: string; canEdit: boolean; items: TestingItem[] }

export const testingApi = {
  async list(): Promise<TestingProgress> {
    const { data } = await apiClient.get('/admin/testing/', { timeout: 12000 });
    if (!data.success) throw new Error(data.error || 'Could not load testing progress.');
    return data.data;
  },
  async update(item: TestingItem, completed: boolean, notes: string): Promise<Partial<TestingItem>> {
    try {
      const { data } = await apiClient.patch(`/admin/testing/${item.id}`, { completed, notes, revision: item.revision }, { timeout: 12000 });
      if (!data.success) throw new Error(data.error || 'Could not save testing progress.');
      return data.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message || 'Could not save testing progress.');
    }
  },
};
