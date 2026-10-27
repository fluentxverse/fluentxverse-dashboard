export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const ADMIN_THEME_KEY = 'fxv_admin_theme';

export function themePreference(value: unknown): ThemePreference {
  return value === 'dark' || value === 'light' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}

// Full-screen materials and interview rooms own their themes, independently of the workspace.
export function isStandaloneThemeRoute(path: string, search = ''): boolean {
  return /^\/(?:business-english|conversational-skills|young-learners)-(?:preview|visual-editor)(?:\/|$)/.test(path)
    || /^\/(?:discussion-questions-visual-editor|daily-dispatch-preview|interview-room)(?:\/|$)/.test(path)
    || /^\/daily-dispatch\/(?:preview|archives|student)(?:\/|$)/.test(path)
    || (path === '/lesson-material-maker' && ['previewToken', 'src'].some(key => new URLSearchParams(search).has(key)));
}
