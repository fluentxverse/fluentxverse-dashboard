import { apiClient } from './apiClient';

const api = apiClient;

export interface AdminUser {
  userId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'superadmin';
}

export interface AdminListItem {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  role: 'admin' | 'superadmin';
  createdAt: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  user?: AdminUser;
  error?: string;
}

export interface MeResponse {
  success: boolean;
  user?: AdminUser;
  error?: string;
}

export interface AdminListResponse {
  success: boolean;
  data?: AdminListItem[];
  error?: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  error?: string;
}

export const authApi = {
  /**
   * Login admin user
   */
  login: async (username: string, password: string): Promise<AdminUser> => {
    const response = await api.post<LoginResponse>('/admin/login', { username, password });
    if (!response.data.success || !response.data.user) {
      throw new Error(response.data.error || 'Login failed');
    }
    return response.data.user;
  },

  /**
   * Logout admin user
   */
  logout: async (): Promise<void> => {
    await api.post('/admin/logout');
  },

  /**
   * Get current admin user
   */
  getMe: async (): Promise<AdminUser | null> => {
    try {
      const response = await api.get<MeResponse>('/admin/me');
      if (!response.data.success || !response.data.user) {
        return null;
      }
      return response.data.user;
    } catch {
      return null;
    }
  },

  /**
   * List all admin users (superadmin only)
   */
  listAdmins: async (): Promise<AdminListItem[]> => {
    const response = await api.get<AdminListResponse>('/admin/list');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to list admins');
    }
    return response.data.data;
  },

  /**
   * Create a new admin user (superadmin only)
   */
  createAdmin: async (data: {
    username: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: 'admin' | 'superadmin';
  }): Promise<AdminListItem> => {
    const response = await api.post<{ success: boolean; data?: AdminListItem; error?: string }>('/admin/create', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to create admin');
    }
    return response.data.data;
  },

  /**
   * Delete an admin user (superadmin only)
   */
  deleteAdmin: async (adminId: string): Promise<void> => {
    const response = await api.delete<{ success: boolean; error?: string }>(`/admin/${adminId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete admin');
    }
  },

  /**
   * Update an admin user (superadmin only)
   */
  updateAdmin: async (adminId: string, data: {
    firstName?: string;
    lastName?: string;
    role?: 'admin' | 'superadmin';
  }): Promise<AdminListItem> => {
    const response = await api.put<{ success: boolean; data?: AdminListItem; error?: string }>(`/admin/${adminId}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Failed to update admin');
    }
    return response.data.data;
  },

  /**
   * Change password for current admin
   */
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    const response = await api.post<ChangePasswordResponse>('/admin/change-password', {
      currentPassword,
      newPassword,
    });
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to change password');
    }
  },
};
