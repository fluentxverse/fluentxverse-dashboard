import { describe, expect, test } from 'bun:test';
import { activityTime } from '../src/utils/activityTime';

describe('dashboard activity display', () => {
  const now = Date.parse('2026-10-12T01:30:00Z');
  test('uses the original event time and PHT for an exact date', () => {
    const result = activityTime('2026-10-12T00:30:00Z', now);
    expect(result.relative).toBe('1 hour ago');
    expect(result.absolute).toBe('Oct 12, 2026, 8:30 AM PHT');
    expect(result.dateTime).toBe('2026-10-12T00:30:00.000Z');
    expect(activityTime('2026-10-12T08:30:00+08:00',now)).toEqual(result);
  });
  test('ages past Just now as the clock advances without refetching the event', () => {
    const timestamp = new Date(now-30_000).toISOString();
    expect(activityTime(timestamp,now).relative).toBe('Just now');
    expect(activityTime(timestamp,now+30_000).relative).toBe('1 minute ago');
    expect(activityTime(timestamp,now+90_000).relative).toBe('2 minutes ago');
    expect(activityTime(timestamp,now+90_000).dateTime).toBe(timestamp);
  });
  test('never calls invalid or future timestamps Just now', () => {
    for (const timestamp of [null,undefined,'','invalid']) {
      expect(activityTime(timestamp,now)).toEqual({relative:'Date unavailable',absolute:null,dateTime:undefined});
    }
    expect(activityTime(new Date(now+3600_000).toISOString(),now).relative).toBe('in 1 hour');
    expect(activityTime(new Date(now-86400_000).toISOString(),now).relative).toBe('1 day ago');
  });
});
