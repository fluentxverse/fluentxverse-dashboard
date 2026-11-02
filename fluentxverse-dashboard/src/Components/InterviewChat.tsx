import { useEffect, useRef, useState } from 'preact/hooks';
import { INTERVIEW_MESSAGE_LIMIT, type InterviewMessage } from '../../../shared/interviewChat';
import '../../../shared/ui/interview-chat.css';

export default function InterviewChat(props: { messages: InterviewMessage[]; ready: boolean; ended: boolean; send: (text: string) => void }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [props.messages.length]);
  const send = (event: Event) => {
    event.preventDefault();
    try { props.send(draft); setDraft(''); setError(''); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Message could not be sent. Please retry.'); }
  };
  return <section className="interview-chat" aria-label="Interview chat">
    <header><h2>Interview chat</h2><span role="status">{props.ended ? 'Interview ended' : props.ready ? 'Connected' : 'Waiting for connection'}</span></header>
    <div ref={log} className="interview-chat-log" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions">
      {!props.messages.length && <p className="interview-chat-empty">No messages yet.</p>}
      {props.messages.map(message => <div key={message.id} className={`interview-chat-message${message.mine ? ' mine' : ''}`}><strong>{message.mine ? 'You' : 'Candidate'}</strong><p>{message.text}</p></div>)}
    </div>
    <form onSubmit={send}>
      <textarea aria-label="Message" placeholder="Type a message..." rows={3} maxLength={INTERVIEW_MESSAGE_LIMIT} value={draft} disabled={props.ended} onInput={event => { setDraft(event.currentTarget.value); setError(''); }} onPaste={event => { if (event.clipboardData?.files.length) event.preventDefault(); }} onDrop={event => event.preventDefault()} />
      <button type="submit" title="Send message" aria-label="Send message" disabled={props.ended || !props.ready || !draft.trim()}><i aria-hidden="true" className="ri-send-plane-line"/></button>
    </form>
    {error && <p className="interview-chat-error" role="alert">{error}</p>}
  </section>;
}
