import { describe, expect, test } from 'bun:test';
import { isBusinessA4Pilot, paginateA4, type A4MeasuredSection } from '../src/components/businessEnglish/a4Pagination';

const section = (id: string, height: number, stage = 0, units = [height]): A4MeasuredSection => ({ id, label: id, height, stage, units });

describe('Business English A4 pagination', () => {
  test('moves an entire activity when the remaining space is too small', () => {
    const pages = paginateA4([section('warmup', 400), section('expressions', 500)], 800);
    expect(pages.map(page => page.parts.map(part => part.sectionId))).toEqual([['warmup'], ['expressions']]);
    expect(pages.every(page => page.used <= 800)).toBe(true);
  });
  test('starts major stages and manual page breaks on fresh sheets without blank pages', () => {
    const pages = paginateA4([section('a', 100), section('b', 100), section('c', 100, 1)], 800, { breaksBefore: ['a', 'b', 'c'] });
    expect(pages.map(page => page.parts.map(part => part.sectionId))).toEqual([['a'], ['b'], ['c']]);
  });
  test('a long group continues only at complete item boundaries', () => {
    const pages = paginateA4([section('drills', 1100, 0, [420, 360, 320])], 800);
    expect(pages.map(page => page.parts.map(part => part.unit))).toEqual([[0, 1], [2]]);
    expect(pages.flatMap(page => page.parts).map(part => part.continued)).toEqual([false, false, true]);
    expect(pages.every(page => page.used <= 800)).toBe(true);
  });
  test('allowing item breaks can use available space without shrinking or losing an item', () => {
    const sections = [section('intro', 500), section('expressions', 500, 0, [220, 260])];
    expect(paginateA4(sections, 800).map(page => page.parts.length)).toEqual([1, 1]);
    const pages = paginateA4(sections, 800, { allowSplit: ['expressions'] });
    expect(pages.map(page => page.parts.length)).toEqual([2, 1]);
    expect(pages.flatMap(page => page.parts).map(part => [part.sectionId, part.unit])).toEqual([['intro', null], ['expressions', 0], ['expressions', 1]]);
  });
  test('flags an indivisible oversized activity instead of silently marking it as fitted', () => {
    const pages = paginateA4([section('long-task', 1000), section('next', 200)], 800);
    expect(pages).toHaveLength(2);
    expect(pages[0]!.parts[0]!.overflow).toBe(true);
    expect(pages[1]!.parts[0]!.overflow).toBe(false);
  });
  test('the pilot only affects Business English Level 3 Chapter 1 Lesson 1', () => {
    const lesson = { course: 'business-english', level: 3, chapter: 1, lessonNumber: 1 };
    expect(isBusinessA4Pilot(lesson)).toBe(true);
    expect(isBusinessA4Pilot({ ...lesson, lessonNumber: 2 })).toBe(false);
    expect(isBusinessA4Pilot({ ...lesson, chapter: 2 })).toBe(false);
    expect(isBusinessA4Pilot({ ...lesson, course: 'conversational-skills' })).toBe(false);
  });
});
