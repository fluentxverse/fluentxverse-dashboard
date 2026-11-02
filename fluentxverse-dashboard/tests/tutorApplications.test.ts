import { expect, test } from 'bun:test';
import { applicationPage, type TutorApplication } from '../../shared/tutorApplications';

const applicant = (id: string, extra: Partial<TutorApplication> = {}): TutorApplication => ({
  id, name: id, email: `${id}@example.invalid`, registeredAt: '2026-10-28', status: 'pending_written',
  writtenExamPassed: false, speakingExamPassed: false, interviewResult: null, interviewSlotId: null, interviewDate: null, profileStatus: 'incomplete', ...extra,
});

test('application totals span all pages and retain interview passes beyond exam completion', () => {
  const items = Array.from({ length: 55 }, (_, index) => applicant(`new-${index}`));
  items.push(applicant('passed', { status: 'interview_passed', writtenExamPassed: true, speakingExamPassed: true, interviewResult: 'pass', interviewSlotId: 'passed-slot' }));
  items.push(applicant('approved', { status: 'certified', interviewResult: 'pass', profileStatus: 'approved' }));
  items.push(applicant('profile-review', { status: 'pending_profile', profileStatus: 'pending_review', interviewResult: 'pass' }));
  items.push(applicant('failed', { status: 'interview_failed', interviewResult: 'fail' }));
  const first = applicationPage(items, 'all', 1, 10);
  expect(first.items).toHaveLength(10);
  expect(first.counts.total).toBe(59);
  expect(first.counts.interviewPassed).toBe(3);
  expect(first.counts.pendingProfile).toBe(1);
  expect(first.counts.certified).toBe(1);
  const passed = applicationPage(items, 'interview_passed', 1, 10);
  expect(passed.total).toBe(3);
  expect(passed.items.map(item => item.id)).toEqual(['passed', 'approved', 'profile-review']);
  expect(passed.counts).toEqual(first.counts);
  expect(applicationPage(items, 'all', 999, 10).page).toBe(6);
  expect(applicationPage(items, 'all', 6, 10).items).toHaveLength(9);
  expect(applicationPage([], 'all', 99, 10)).toMatchObject({ items: [], total: 0, page: 1, pageCount: 1 });
});

test('processing and profile-review counts use their actual stages', () => {
  const items = [applicant('speaking', { status: 'pending_speaking' }), applicant('processing', { status: 'processing' }),
    applicant('incomplete-profile', { status: 'interview_passed', interviewResult: 'pass' })];
  const result = applicationPage(items, 'pending_speaking', 1, 10);
  expect(result.counts.pendingSpeaking).toBe(1);
  expect(result.counts.processing).toBe(1);
  expect(result.counts.pendingProfile).toBe(0);
  expect(result.items.map(item => item.id)).toEqual(['speaking']);
});
