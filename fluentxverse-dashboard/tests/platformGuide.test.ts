import { describe, expect, test } from 'bun:test';
import { chapterText, filterGuide, guideChapters, guideGlossary, guideReadingMinutes, guideReferences } from '../src/content/platformGuide';

describe('platform guide', () => {
  test('covers business, operations, technology, privacy and release boundaries', () => {
    expect(guideChapters).toHaveLength(18);
    expect(new Set(guideChapters.map(chapter => chapter.id)).size).toBe(guideChapters.length);
    expect(new Set(guideChapters.map(chapter => chapter.topic)).size).toBe(4);
    expect(guideGlossary.length).toBeGreaterThanOrEqual(20);
    expect(guideReadingMinutes).toBeGreaterThan(15);
    for (const chapter of guideChapters) {
      expect(chapter.id).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
      expect(chapterText(chapter).split(/\s+/).length).toBeGreaterThan(150);
      for (const block of chapter.blocks) {
        if (block.kind === 'table') for (const row of block.rows) expect(row.length).toBe(block.headings.length);
      }
    }
  });
  test('searches body text and requires all query words within a chapter', () => {
    expect(filterGuide('  VFY ETH  ').some(chapter => chapter.id === 'engine-and-networks')).toBe(true);
    expect(filterGuide('transcript rubric').some(chapter => chapter.id === 'materials-and-ai')).toBe(true);
    expect(filterGuide('nonce nonexistent-question')).toHaveLength(0);
    expect(filterGuide('', 'Business').every(chapter => chapter.topic === 'Business')).toBe(true);
    expect(filterGuide('USD cents', 'Privacy')).toHaveLength(0);
    expect(filterGuide('')).toHaveLength(18);
  });
  test('keeps key operating and commercial limitations explicit', () => {
    const content = Object.fromEntries(guideChapters.map(chapter => [chapter.id, chapterText(chapter)]));
    expect(content['scheduling']).toContain('3 minutes after end');
    expect(content['attendance-and-issues']).toContain('five-minute');
    expect(content['commercial-access']).toContain('not proof of what every running deployment has enabled');
    expect(content['finance-and-compensation']).toContain('It does not calculate');
    expect(content['privacy-features']).toContain('not an independent proof');
    expect(content['calls-and-recordings']).toContain('signed recording agreement');
    expect(content['engine-and-networks']).toContain('remain pinned');
    expect(guideReferences.every(reference => reference.href.startsWith('https://'))).toBe(true);
  });
});
