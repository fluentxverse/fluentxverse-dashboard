import { describe, expect, test } from 'bun:test';
import { isLessonMediaRequest, normalizeLessonMedia, resolveMediaUrl } from '../../shared/lessonMedia';
import { mediaUrl as dashboardMedia } from '../src/utils/mediaUrl';
import { mediaUrl as tutorMedia } from '../../fluentxverse-tutor-solid-prototype/tutor/utils/mediaUrl';
import { apiClient as dashboardClient } from '../src/api/apiClient';
import { client as tutorClient } from '../../fluentxverse-tutor-solid-prototype/tutor/api/utils';

const priorWindow = globalThis.window;
if (typeof window === 'undefined') (globalThis as any).window = { location: { hostname: '127.0.0.1' } };
const { mediaUrl: studentMedia } = await import('../../fluentxverse-student-solid-prototype/student/utils/mediaUrl');
const { client: studentClient } = await import('../../fluentxverse-student-solid-prototype/student/api/utils');
if (priorWindow === undefined) delete (globalThis as any).window;

const base = 'https://api.fluentxverse.com';
const path = '/lessons/conversational-skills/ja/l3-c1/v1/vocab-new-resident-kyoto.webp';
const legacy = `https://api.fluentxverse.xyz/lesson/files${path}?v=2#image`;
const expected = `${base}/lesson/files${path}?v=2#image`;

describe('lesson media domain migration', () => {
  test('all three apps share the same storage URL handling', () => {
    for (const resolve of [resolveMediaUrl, dashboardMedia, tutorMedia, studentMedia]) {
      for (const value of [legacy, legacy.replace('https:', 'http:'), legacy.replace('https:', ''), `/lesson/files${path}?v=2#image`, `${path}?v=2#image`, `http://seaweed-filer:8888${path}?v=2#image`, `http://localhost:8765/lesson/files${path}?v=2#image`]) {
        expect(resolve(value, `${base}/`)).toBe(expected);
      }
      expect(resolve(legacy, 'https://api.fluentxverse.xyz')).toBe(legacy);
      expect(resolve(legacy, 'http://127.0.0.1:8782')).toBe(`http://127.0.0.1:8782/lesson/files${path}?v=2#image`);
    }
  });

  test('does not rewrite third-party media, app assets, credentials or spoofed origins', () => {
    for (const value of [
      'https://images.unsplash.com/photo-123?w=900', '/assets/img/example.webp',
      'blob:https://student.fluentxverse.com/local', 'data:image/svg+xml,<svg></svg>',
      `https://api.fluentxverse.xyz.evil.test/lesson/files${path}`,
      `https://api.fluentxverse.xyz:444/lesson/files${path}`,
      `https://name:pass@api.fluentxverse.xyz/lesson/files${path}`,
      `ftp://seaweed-filer:8888${path}`, 'https://api.fluentxverse.xyz/student/me',
      'https://other.test/?next=https://api.fluentxverse.xyz/lesson/files/lessons/image.png',
    ]) expect(resolveMediaUrl(value, base)).toBe(value);
    expect(resolveMediaUrl(' ', base)).toBeUndefined();
  });

  test('walks nested course data without mutating drafts, text, nulls or numbers', () => {
    const original = { lesson: { level: 3, goal: '  Preserve text spacing.  ', backgroundImage: legacy,
      learnData: { steps: [{ vocabularyItems: [{ image: legacy }], pronunciationPart: { images: [legacy] } }] },
      beData: { activityBlocks: [{ image: legacy }] }, image: null, audio: '/assets/audio.mp3' } };
    const snapshot = structuredClone(original);
    const migrated = normalizeLessonMedia(original, base);
    expect(migrated.lesson.backgroundImage).toBe(expected);
    expect(migrated.lesson.learnData.steps[0].vocabularyItems[0].image).toBe(expected);
    expect(migrated.lesson.learnData.steps[0].pronunciationPart.images).toEqual([expected]);
    expect(migrated.lesson.beData.activityBlocks[0].image).toBe(expected);
    expect(migrated.lesson.goal).toBe(snapshot.lesson.goal);
    expect(migrated.lesson.level).toBe(3);
    expect(migrated.lesson.image).toBeNull();
    expect(original).toEqual(snapshot);
    expect(normalizeLessonMedia(migrated, base)).toEqual(migrated);
    const binary = new ArrayBuffer(4);
    expect(normalizeLessonMedia(binary, base)).toBe(binary);
  });

  test('only material endpoints opt into payload normalization', () => {
    for (const url of ['/lesson-materials/public/id', '/lesson/id/student', '/young-learners/public/id', '/dispatch/123', `${base}/lesson-materials/course/business-english?level=1`]) expect(isLessonMediaRequest(url)).toBe(true);
    for (const url of ['/student/me', '/tutor/login', '/lesson-materials-evil', '/admin/settings', undefined]) expect(isLessonMediaRequest(url)).toBe(false);
  });

  for (const [app, client] of [['dashboard', dashboardClient], ['tutor', tutorClient], ['student', studentClient]] as const) {
    test(`${app} normalizes lesson responses before consumers render them`, async () => {
      const adapter = async (config: any) => ({ config, data: { lesson: { image: legacy } }, status: 200, statusText: 'OK', headers: {} });
      const result = await client.get('/lesson-materials/public/fixture', { adapter });
      expect(result.data.lesson.image).toBe(`${client.defaults.baseURL}/lesson/files${path}?v=2#image`);
      const other = await client.get('/student/me', { adapter });
      expect(other.data.lesson.image).toBe(legacy);
    });
  }
});
