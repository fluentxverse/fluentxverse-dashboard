export type InterviewPeriod = 'morning' | 'afternoon' | 'evening';

const manilaHour = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23',
});

export function currentInterviewPeriod(now = new Date()): InterviewPeriod {
  const hour = Number(manilaHour.format(now));
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
