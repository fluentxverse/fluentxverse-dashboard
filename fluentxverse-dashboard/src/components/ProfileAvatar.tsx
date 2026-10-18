import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { API_BASE_URL } from '../config/api';
import { mediaUrl } from '../utils/mediaUrl';

export default function ProfileAvatar({ src, name, className, fallback }: {
  src?: string; name: string; className: string; fallback: ComponentChildren;
}) {
  const source = mediaUrl(src, API_BASE_URL);
  const [failedSource, setFailedSource] = useState<string>();
  return <div className={className}>
    {source && source !== failedSource
      ? <img src={source} alt={name} onError={() => setFailedSource(source)} />
      : fallback}
  </div>;
}
