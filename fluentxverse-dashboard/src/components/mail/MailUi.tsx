import { createPortal } from 'preact/compat';
import { useLayoutEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

export const MailIcon = ({ name }: { name: string }) => <i className={`ri-${name}`} aria-hidden="true" />;
export function MailTool({ icon, label, onClick, disabled, active, type = 'button' }: { icon: string; label: string; onClick?: () => void; disabled?: boolean; active?: boolean; type?: 'button' | 'submit' }) {
  return <button type={type} className={`mail-tool ${active ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={active === undefined ? undefined : active} disabled={disabled} onClick={onClick}><MailIcon name={icon}/></button>;
}
export function MailDialog({ title, children, onClose, onEscape, busy = false, wide = false, className = '', headerActions, minimized = false }: { title: string; children: ComponentChildren; onClose: () => void; onEscape?: () => void; busy?: boolean; wide?: boolean; className?: string; headerActions?: ComponentChildren; minimized?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const escape = useRef(onEscape || onClose); escape.current = onEscape || onClose;
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => { previous?.focus(); };
  }, []);
  useLayoutEffect(() => {
    const dialog = ref.current!, overflow = document.body.style.overflow;
    if (dialog.open) dialog.close();
    if (minimized) dialog.show(); else { document.body.style.overflow = 'hidden'; dialog.showModal(); }
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [minimized]);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      ref.current?.style.setProperty('--mail-viewport-height', `${viewport.height}px`);
      ref.current?.style.setProperty('--mail-viewport-top', `${viewport.offsetTop}px`);
    };
    update(); viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); };
  }, []);
  return createPortal(<dialog ref={ref} className={`mail-dialog ${wide ? 'mail-dialog-wide' : ''} ${className}`} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) escape.current(); }}>
    <header><h2>{title}</h2><div className="mail-dialog-header-actions">{headerActions}<MailTool icon="close-line" label={`Close ${title.toLowerCase()}`} disabled={busy} onClick={onClose}/></div></header>{children}
  </dialog>, document.body);
}
export const mailDate = (date: string) => {
  const value = new Date(date); return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(value.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
};
export const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
