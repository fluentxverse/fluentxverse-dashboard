import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { isStandaloneThemeRoute, resolveTheme, themePreference } from '../src/theme/adminTheme';

describe('admin theme preference', () => {
  test('defaults invalid and missing values to system', () => {
    for (const value of [null, undefined, '', 'unknown', 'DARK', {}]) expect(themePreference(value)).toBe('system');
    expect(themePreference('dark')).toBe('dark');
    expect(themePreference('light')).toBe('light');
  });
  test('explicit choices override the operating system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
  test('lesson documents keep independent themes, but management lists do not', () => {
    for (const path of ['/business-english-preview/id', '/conversational-skills-visual-editor/id', '/young-learners-preview/id', '/discussion-questions-visual-editor/id', '/daily-dispatch-preview/id', '/daily-dispatch/preview/id', '/daily-dispatch/archives/2026-10', '/daily-dispatch/student/id', '/interview-room/id']) expect(isStandaloneThemeRoute(path)).toBe(true);
    for (const path of ['/', '/email', '/settings', '/tutors', '/business-english-editor', '/daily-dispatch', '/lesson-material-maker', '/lesson-material-view']) expect(isStandaloneThemeRoute(path)).toBe(false);
    expect(isStandaloneThemeRoute('/lesson-material-maker', '?previewToken=test')).toBe(true);
    expect(isStandaloneThemeRoute('/lesson-material-maker', '?src=test')).toBe(true);
  });
  test('dark text, status and accent tokens meet normal-text contrast on their surfaces', () => {
    const css = readFileSync(new URL('../src/styles/admin-theme.css', import.meta.url), 'utf8');
    const colors = Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/g)].map(match => [match[1], match[2]]));
    const luminance = (hex: string) => {
      const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
      return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
    };
    const contrast = (a: string, b: string) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
    for (const text of ['text', 'muted', 'accent', 'success', 'warning', 'danger', 'cyan', 'purple']) {
      for (const surface of ['surface', 'surface-soft', 'surface-muted']) expect(contrast(colors[`--admin-${text}`], colors[`--admin-${surface}`])).toBeGreaterThanOrEqual(4.5);
      if (colors[`--admin-bg-${text}`]) expect(contrast(colors[`--admin-${text}`], colors[`--admin-bg-${text}`])).toBeGreaterThanOrEqual(4.5);
    }
  });
});
