import { h } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  // Convenience methods
  success: (message: string, title?: string) => string;
  error: (message: string, title?: string) => string;
  warning: (message: string, title?: string) => string;
  info: (message: string, title?: string) => string;
  // Confirmation dialog replacement
  confirm: (message: string, options?: {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Confirmation modal state
interface ConfirmState {
  isOpen: boolean;
  message: string;
  title?: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: ((value: boolean) => void) | null;
}

export const ToastProvider = ({ children }: { children: any }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
    title: undefined,
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    resolve: null,
  });

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };
    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const success = useCallback((message: string, title?: string) => {
    return addToast({ type: 'success', message, title });
  }, [addToast]);

  const error = useCallback((message: string, title?: string) => {
    return addToast({ type: 'error', message, title, duration: 8000 });
  }, [addToast]);

  const warning = useCallback((message: string, title?: string) => {
    return addToast({ type: 'warning', message, title, duration: 6000 });
  }, [addToast]);

  const info = useCallback((message: string, title?: string) => {
    return addToast({ type: 'info', message, title });
  }, [addToast]);

  const confirm = useCallback((message: string, options?: {
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title: options?.title,
        confirmLabel: options?.confirmLabel ?? 'Confirm',
        cancelLabel: options?.cancelLabel ?? 'Cancel',
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback((result: boolean) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState(prev => ({ ...prev, isOpen: false, resolve: null }));
  }, [confirmState.resolve]);

  // Register global context for use outside React
  useEffect(() => {
    setGlobalToastContext({ toasts, addToast, removeToast, success, error, warning, info, confirm });
  }, [toasts, addToast, removeToast, success, error, warning, info, confirm]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info, confirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmState.isOpen && (
        <div className="toast-confirm-overlay" onClick={() => handleConfirm(false)}>
          <div className="toast-confirm-modal" onClick={e => e.stopPropagation()}>
            {confirmState.title && (
              <h3 className="toast-confirm-title">{confirmState.title}</h3>
            )}
            <p className="toast-confirm-message">{confirmState.message}</p>
            <div className="toast-confirm-actions">
              <button
                type="button"
                className="toast-confirm-btn cancel"
                onClick={() => handleConfirm(false)}
              >
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className="toast-confirm-btn confirm"
                onClick={() => handleConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};

// Individual Toast Item
const ToastItem = ({ toast, onClose }: { toast: Toast; onClose: () => void }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onClose, 300);
      }, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onClose]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <i className="ri-check-line" />;
      case 'error':
        return <i className="ri-close-circle-line" />;
      case 'warning':
        return <i className="ri-alert-line" />;
      case 'info':
        return <i className="ri-information-line" />;
    }
  };

  return (
    <div className={`toast-item toast-${toast.type} ${isExiting ? 'toast-exit' : ''}`}>
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
        {toast.action && (
          <button
            type="button"
            className="toast-action"
            onClick={() => {
              toast.action?.onClick();
              handleClose();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button type="button" className="toast-close" onClick={handleClose}>
        <i className="ri-close-line" />
      </button>
    </div>
  );
};

// Global toast instance for use outside of React components
// This requires ToastProvider to be mounted and will store pending toasts
let globalToastContext: ToastContextValue | null = null;

export const setGlobalToastContext = (context: ToastContextValue) => {
  globalToastContext = context;
};

// Global toast functions - can be called from anywhere
export const toast = {
  success: (message: string, title?: string) => {
    if (globalToastContext) {
      return globalToastContext.success(message, title);
    }
    console.warn('Toast not initialized. Make sure ToastProvider is mounted.');
    return '';
  },
  error: (message: string, title?: string) => {
    if (globalToastContext) {
      return globalToastContext.error(message, title);
    }
    console.warn('Toast not initialized. Make sure ToastProvider is mounted.');
    return '';
  },
  warning: (message: string, title?: string) => {
    if (globalToastContext) {
      return globalToastContext.warning(message, title);
    }
    console.warn('Toast not initialized. Make sure ToastProvider is mounted.');
    return '';
  },
  info: (message: string, title?: string) => {
    if (globalToastContext) {
      return globalToastContext.info(message, title);
    }
    console.warn('Toast not initialized. Make sure ToastProvider is mounted.');
    return '';
  },
};

// Async confirm dialog - replacement for window.confirm
export const toastConfirm = async (
  message: string,
  title?: string,
  options?: { confirmLabel?: string; cancelLabel?: string }
): Promise<boolean> => {
  if (globalToastContext) {
    return globalToastContext.confirm(message, { title, ...options });
  }
  // Fallback to native confirm if toast not initialized
  console.warn('Toast not initialized. Falling back to native confirm.');
  return window.confirm(message);
};

export default ToastProvider;
