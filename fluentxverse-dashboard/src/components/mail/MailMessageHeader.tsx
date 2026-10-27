import { useEffect, useRef } from 'preact/hooks';
import type { MailMessage } from '../../api/mail.api';
import { mailDate, MailIcon, MailTool } from './MailUi';

export default function MailMessageHeader({ message, address, busy, onStar }: { message: MailMessage; address: string; busy: boolean; onStar: () => void }) {
  const details = useRef<HTMLDetailsElement>(null);
  const name = message.from.map(item => item.name || item.address).join(', ') || 'Unknown sender';
  const from = message.from.map(item => item.address).join(', ');
  const recipients = message.to.map(item => item.address.toLowerCase() === address.toLowerCase() ? 'me' : item.name || item.address).join(', ') || 'undisclosed recipients';
  const date = new Date(message.date);
  useEffect(() => {
    const dismiss = (event: Event) => { if (details.current?.open && !details.current.contains(event.target as Node)) details.current.open = false; };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !details.current?.open) return;
      details.current.open = false; details.current.querySelector('summary')?.focus(); event.preventDefault();
    };
    document.addEventListener('pointerdown', dismiss); document.addEventListener('focusin', dismiss); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('focusin', dismiss); document.removeEventListener('keydown', escape); };
  }, []);
  return <div className="mail-message-heading">
    <h2>{message.subject}</h2>
    <div className="mail-sender-detail">
      <span className="mail-sender-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <div className="mail-sender-main">
        <div className="mail-sender-line"><strong>{name}</strong>{from && from !== name && <span className="mail-sender-email">&lt;{from}&gt;</span>}</div>
        <details ref={details} className="mail-header-details">
          <summary aria-label="Message details" title="Message details"><span>to {recipients}</span><MailIcon name="arrow-down-s-fill"/></summary>
          <dl className="mail-address-details">
            <dt>From</dt><dd>{from || 'Unknown sender'}</dd>
            <dt>To</dt><dd>{message.to.map(item => item.address).join(', ') || 'Undisclosed recipients'}</dd>
            {!!message.cc.length && <><dt>Cc</dt><dd>{message.cc.map(item => item.address).join(', ')}</dd></>}
            {message.replyTo?.length ? <><dt>Reply-To</dt><dd>{message.replyTo.map(item => item.address).join(', ')}</dd></> : null}
            <dt>Date</dt><dd>{date.toLocaleString()}</dd>
          </dl>
        </details>
      </div>
      <div className="mail-header-end"><time dateTime={message.date} title={date.toLocaleString()}><span className="mail-date-desktop">{date.toLocaleString(undefined, { month: 'short', day: 'numeric', ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}), hour: 'numeric', minute: '2-digit' })}</span><span className="mail-date-mobile">{mailDate(message.date)}</span></time><MailTool icon={message.starred ? 'star-fill' : 'star-line'} label={message.starred ? 'Unstar message' : 'Star message'} active={message.starred} disabled={busy} onClick={onStar}/></div>
    </div>
  </div>;
}
