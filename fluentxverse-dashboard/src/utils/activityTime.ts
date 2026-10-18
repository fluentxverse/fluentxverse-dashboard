const relative = new Intl.RelativeTimeFormat('en-US', { numeric:'always' });
const absolute = new Intl.DateTimeFormat('en-US', {
  timeZone:'Asia/Manila', year:'numeric', month:'short', day:'numeric', hour:'numeric', minute:'2-digit',
});

export function activityTime(timestamp: string | null | undefined, now = Date.now()) {
  const milliseconds = typeof timestamp === 'string' && timestamp.trim() ? Date.parse(timestamp) : NaN;
  if (!Number.isFinite(milliseconds)) return { relative:'Date unavailable', absolute:null, dateTime:undefined };
  const delta = milliseconds - now;
  let label = 'Just now';
  if (delta <= -60_000 || delta > 5_000) {
    const unit = Math.abs(delta) >= 86_400_000 ? 'day' : Math.abs(delta) >= 3_600_000 ? 'hour' : Math.abs(delta) >= 60_000 ? 'minute' : 'second';
    const divisor = {day:86_400_000,hour:3_600_000,minute:60_000,second:1000}[unit];
    label = relative.format(Math.trunc(delta / divisor), unit);
  }
  return { relative:label, absolute:absolute.format(milliseconds) + ' PHT', dateTime:new Date(milliseconds).toISOString() };
}
