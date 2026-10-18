import { useAuthContext } from '../../context/AuthContext';
import './SessionExpiredModal.css';

export const SessionExpiredModal = () => {
  const { sessionExpired, sessionExpiredMessage, clearSessionExpired } = useAuthContext();

  if (!sessionExpired) return null;

  const handleLoginRedirect = () => {
    clearSessionExpired();
    // Redirect to login page
    window.location.href = '/login';
  };

  return (
    <div className="session-expired-overlay">
      <div className="session-expired-modal">
        <div className="session-expired-icon">
          <i className="ri-time-line" />
        </div>
        <h2>Session Expired</h2>
        <p>{sessionExpiredMessage || 'Your session has expired. Please log in again to continue.'}</p>
        <div className="session-expired-note">
          <i className="ri-information-line" />
          <span>Don't worry! Your recent changes have been saved locally and will be restored when you log back in.</span>
        </div>
        <button 
          type="button"
          className="session-expired-btn"
          onClick={handleLoginRedirect}
        >
          <i className="ri-login-box-line" />
          Go to Login
        </button>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
