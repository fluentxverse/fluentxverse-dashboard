import { activityTime } from '../utils/activityTime';
import './ActivityTimestamp.css';

export function ActivityTimestamp({ timestamp, now }: { timestamp: string | null; now: number }) {
  const formatted = activityTime(timestamp, now);
  return <time className="activity-timestamp" dateTime={formatted.dateTime} title={formatted.absolute || undefined}>
    {formatted.relative}
    {formatted.absolute && <span className="activity-timestamp-exact">{formatted.absolute}</span>}
  </time>;
}
