import { useState, useEffect } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { authApi, AdminListItem } from '../api/auth.api';
import { toast } from '../Components/Toast/Toast';
import './AdminsPage.css';

interface CreateAdminForm {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'superadmin';
}

export function AdminsPage() {
  const { user } = useAuthContext();
  const [admins, setAdmins] = useState<AdminListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateAdminForm>({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'admin',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const isSuperAdmin = user?.role === 'superadmin';

  useEffect(() => {
    if (isSuperAdmin) {
      loadAdmins();
    }
  }, [isSuperAdmin]);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      const data = await authApi.listAdmins();
      setAdmins(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async (e: Event) => {
    e.preventDefault();
    setCreateError('');

    if (!createForm.username || !createForm.password) {
      setCreateError('Username and password are required');
      return;
    }

    if (createForm.password.length < 8) {
      setCreateError('Password must be at least 8 characters');
      return;
    }

    setCreating(true);
    try {
      await authApi.createAdmin({
        username: createForm.username,
        password: createForm.password,
        firstName: createForm.firstName || undefined,
        lastName: createForm.lastName || undefined,
        role: createForm.role,
      });
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'admin',
      });
      loadAdmins();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create admin');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    try {
      await authApi.deleteAdmin(adminId);
      setDeleteConfirm(null);
      loadAdmins();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete admin');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!isSuperAdmin) {
    return (
      <div class="admins-page">
        <div class="access-denied">
          <i class="ri-shield-keyhole-line"></i>
          <h2>Access Denied</h2>
          <p>Only superadmins can manage admin users.</p>
        </div>
      </div>
    );
  }

  return (
    <div class="admins-page">
      <div class="page-header">
        <div class="header-left">
          <h1>Admin Users</h1>
          <p class="page-description">Manage administrator accounts</p>
        </div>
        <button class="btn-primary" onClick={() => setShowCreateModal(true)}>
          <i class="ri-user-add-line"></i>
          Add Admin
        </button>
      </div>

      {error && (
        <div class="alert alert-error">
          <i class="ri-error-warning-line"></i>
          {error}
        </div>
      )}

      {loading ? (
        <div class="loading-state">
          <i class="ri-loader-4-line spinning"></i>
          <span>Loading admins...</span>
        </div>
      ) : (
        <div class="admins-table-wrapper">
          <table class="admins-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar">
                        {admin.username.substring(0, 2).toUpperCase()}
                      </div>
                      <div class="user-info">
                        <span class="user-name">
                          {admin.firstName || admin.lastName
                            ? `${admin.firstName || ''} ${admin.lastName || ''}`.trim()
                            : admin.username}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <code class="username">{admin.username}</code>
                  </td>
                  <td>
                    <span class={`role-badge ${admin.role}`}>
                      {admin.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                    </span>
                  </td>
                  <td>{formatDate(admin.createdAt)}</td>
                  <td>
                    {admin.id === user?.userId ? (
                      <span class="you-badge">You</span>
                    ) : deleteConfirm === admin.id ? (
                      <div class="delete-confirm">
                        <span>Delete?</span>
                        <button
                          class="btn-confirm-delete"
                          onClick={() => handleDeleteAdmin(admin.id)}
                        >
                          Yes
                        </button>
                        <button
                          class="btn-cancel"
                          onClick={() => setDeleteConfirm(null)}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        class="btn-icon btn-delete"
                        onClick={() => setDeleteConfirm(admin.id)}
                        title="Delete admin"
                      >
                        <i class="ri-delete-bin-line"></i>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colspan={5} class="empty-state">
                    No admin users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div class="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h2>Add New Admin</h2>
              <button class="btn-close" onClick={() => setShowCreateModal(false)}>
                <i class="ri-close-line"></i>
              </button>
            </div>
            <form onSubmit={handleCreateAdmin}>
              <div class="modal-body">
                {createError && (
                  <div class="alert alert-error">
                    <i class="ri-error-warning-line"></i>
                    {createError}
                  </div>
                )}

                <div class="form-group">
                  <label for="username">Username *</label>
                  <input
                    type="text"
                    id="username"
                    value={createForm.username}
                    onInput={(e) =>
                      setCreateForm({ ...createForm, username: (e.target as HTMLInputElement).value })
                    }
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div class="form-group">
                  <label for="password">Password *</label>
                  <input
                    type="password"
                    id="password"
                    value={createForm.password}
                    onInput={(e) =>
                      setCreateForm({ ...createForm, password: (e.target as HTMLInputElement).value })
                    }
                    placeholder="Enter password"
                    required
                    minLength={8}
                  />
                  <span class="helper-text">Must be at least 8 characters</span>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label for="firstName">First Name</label>
                    <input
                      type="text"
                      id="firstName"
                      value={createForm.firstName}
                      onInput={(e) =>
                        setCreateForm({ ...createForm, firstName: (e.target as HTMLInputElement).value })
                      }
                      placeholder="First name"
                    />
                  </div>
                  <div class="form-group">
                    <label for="lastName">Last Name</label>
                    <input
                      type="text"
                      id="lastName"
                      value={createForm.lastName}
                      onInput={(e) =>
                        setCreateForm({ ...createForm, lastName: (e.target as HTMLInputElement).value })
                      }
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div class="form-group">
                  <label for="role">Role *</label>
                  <select
                    id="role"
                    value={createForm.role}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        role: (e.target as HTMLSelectElement).value as 'admin' | 'superadmin',
                      })
                    }
                  >
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" class="btn-primary" disabled={creating}>
                  {creating ? (
                    <>
                      <i class="ri-loader-4-line spinning"></i>
                      Creating...
                    </>
                  ) : (
                    <>
                      <i class="ri-user-add-line"></i>
                      Create Admin
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
