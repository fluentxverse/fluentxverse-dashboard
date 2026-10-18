import ProfileAvatar from './ProfileAvatar';

export default function SessionAvatar({ src, name, kind, detail = false }: {
  src?: string; name: string; kind: 'tutor' | 'student'; detail?: boolean;
}) {
  return <ProfileAvatar src={src} name={name} className={`${detail ? 'participant-avatar' : 'user-avatar'} session-avatar`}
    fallback={<div className={`avatar-placeholder ${kind}`} role="img" aria-label={`${name} ${kind} avatar`}>
          <i className={kind === 'tutor' ? 'ri-user-star-line' : 'ri-graduation-cap-line'} aria-hidden="true" />
        </div>} />;
}
