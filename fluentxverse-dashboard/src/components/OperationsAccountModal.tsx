import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { OperationsAccountDetail } from './OperationsAccountDetail';
import './OperationsAccountModal.css';

export function OperationsAccountModal({ tutorId, initialTab, onClose }: {
  tutorId: string; initialTab: string; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    ref.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(<dialog ref={ref} className="operations-dialog account-dialog" aria-labelledby="account-detail-title"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <OperationsAccountDetail key={tutorId} role="tutor" id={tutorId} initialTab={initialTab} onClose={onClose} />
  </dialog>, document.body);
}
