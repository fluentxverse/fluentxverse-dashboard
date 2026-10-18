import { useState } from 'preact/hooks';
import { useAuthContext } from '../context/AuthContext';
import { authApi } from '../api/auth.api';
import './SettingsPage.css';

export function SettingsPage() {
  const { user } = useAuthContext();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChangePassword = async (e: Event) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="settings-page">
      <div class="page-header">
        <h1>Settings</h1>
        <p class="page-description">Manage your account settings</p>
      </div>

      <div class="settings-grid">
        {/* Profile Section */}
        <div class="settings-card">
          <div class="card-header">
            <i class="ri-user-line"></i>
            <h2>Profile</h2>
          </div>
          <div class="card-content">
            <div class="profile-info">
              <div class="profile-avatar">
                {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
              </div>
              <div class="profile-details">
                <div class="info-row">
                  <span class="label">Username</span>
                  <span class="value">{user?.username || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">First Name</span>
                  <span class="value">{user?.firstName || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Last Name</span>
                  <span class="value">{user?.lastName || '-'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Role</span>
                  <span class={`role-badge ${user?.role}`}>
                    {user?.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password Section */}
        <div class="settings-card">
          <div class="card-header">
            <i class="ri-lock-password-line"></i>
            <h2>Change Password</h2>
          </div>
          <div class="card-content">
            <form onSubmit={handleChangePassword} class="password-form">
              {error && (
                <div class="alert alert-error">
                  <i class="ri-error-warning-line"></i>
                  {error}
                </div>
              )}
              {success && (
                <div class="alert alert-success">
                  <i class="ri-check-line"></i>
                  {success}
                </div>
              )}

              <div class="form-group">
                <label for="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  value={currentPassword}
                  onInput={(e) => setCurrentPassword((e.target as HTMLInputElement).value)}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div class="form-group">
                <label for="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
                  placeholder="Enter new password"
                  required
                  minLength={8}
                />
                <span class="helper-text">Must be at least 8 characters</span>
              </div>

              <div class="form-group">
                <label for="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              <button type="submit" class="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <i class="ri-loader-4-line spinning"></i>
                    Changing...
                  </>
                ) : (
                  <>
                    <i class="ri-lock-line"></i>
                    Change Password
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
