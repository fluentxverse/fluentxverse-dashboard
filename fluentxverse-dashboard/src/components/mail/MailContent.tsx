import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { MailMessage } from '../../api/mail.api';
import { emailDocument } from './mailDocument';
import { MailIcon } from './MailUi';

export default function MailContent({ message }: { message: MailMessage }) {
  const [plain, setPlain] = useState(false), [images, setImages] = useState(false), [height, setHeight] = useState(200);
  const [token] = useState(() => crypto.randomUUID()), frame = useRef<HTMLIFrameElement>(null);
  const document = useMemo(() => emailDocument(message.html || '', images, token), [message.html, images, token]);
  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== 'null' || event.data?.type !== 'fluentxverse-mail-size' || event.data.token !== token || typeof event.data.height !== 'number' || !Number.isFinite(event.data.height)) return;
      setHeight(Math.max(160, Math.min(60_000, event.data.height + 2)));
    };
    window.addEventListener('message', resize); return () => window.removeEventListener('message', resize);
  }, [token]);
  return <div className="mail-content">
    {message.html && <div className="mail-content-controls"><div className="mail-content-modes" role="group" aria-label="Message format"><button type="button" aria-pressed={!plain} onClick={() => setPlain(false)}>Formatted</button><button type="button" aria-pressed={plain} onClick={() => setPlain(true)}>Plain text</button></div>
      {!plain && document.externalImages > 0 && <div className="mail-image-notice">{!images && <span><MailIcon name="shield-check-line"/>External images are blocked.</span>}<button type="button" className="mail-image-control" title="Loading external images may tell the sender you opened this email." onClick={() => setImages(value => !value)}><MailIcon name={images ? 'image-off-line' : 'image-line'}/>{images ? 'Hide images' : 'Show images'}</button></div>}
    </div>}
    {message.html && !plain ? <iframe {...{ credentialless: true }} ref={frame} className="mail-html-body" style={{ height }} title="Email message content" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={document.source} onLoad={() => frame.current?.contentWindow?.postMessage({ type: 'fluentxverse-mail-measure', token }, '*')}/> : <div className="mail-text-body">{message.text || 'This message has no plain-text content.'}</div>}
  </div>;
}
