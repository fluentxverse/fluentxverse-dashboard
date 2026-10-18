import { useState, useEffect } from 'preact/hooks';
import './OfflineBanner.css';

export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      if (wasOffline) {
        setShowReconnected(true);
        // Hide the "reconnected" message after 3 seconds
        setTimeout(() => setShowReconnected(false), 3000);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  if (!isOffline && !showReconnected) return null;

  return (
    <div className={`offline-banner ${isOffline ? 'offline' : 'reconnected'}`}>
      <div className="offline-banner-content">
        {isOffline ? (
          <>
            <i className="ri-wifi-off-line" />
            <span>You're offline. Changes will be saved locally and synced when you reconnect.</span>
          </>
        ) : (
          <>
            <i className="ri-wifi-line" />
            <span>You're back online!</span>
          </>
        )}
      </div>
    </div>
  );
};

export default OfflineBanner;
