import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { ADMIN_THEME_KEY, isStandaloneThemeRoute, resolveTheme, themePreference, type ResolvedTheme, type ThemePreference } from '../theme/adminTheme';

interface ThemeContextValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (value: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ComponentChildren }) {
  const { path, url } = useLocation();
  const [preference, setValue] = useState<ThemePreference>(() => {
    try { return themePreference(localStorage.getItem(ADMIN_THEME_KEY)); } catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = resolveTheme(preference, systemDark);
  const standalone = isStandaloneThemeRoute(path, new URL(url, window.location.href).search);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemDark(media.matches);
    const sync = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === ADMIN_THEME_KEY || event.key === null)) {
        setValue(themePreference(event.newValue));
      }
    };
    update();
    media.addEventListener('change', update);
    window.addEventListener('storage', sync);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (standalone) {
      if (root.hasAttribute('data-admin-theme')) root.style.removeProperty('color-scheme');
      delete root.dataset.adminTheme;
      return;
    }
    delete root.dataset.materialPage;
    delete root.dataset.materialTheme;
    root.dataset.adminTheme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#141619' : '#f5f7fa');
  }, [theme, standalone]);

  const setPreference = useCallback((value: ThemePreference) => {
    setValue(value);
    try { localStorage.setItem(ADMIN_THEME_KEY, value); } catch { /* Keep the in-memory choice when storage is unavailable. */ }
  }, []);

  return <ThemeContext.Provider value={{ preference, theme, setPreference, toggle: () => setPreference(theme === 'dark' ? 'light' : 'dark') }}>{children}</ThemeContext.Provider>;
}

export function useAdminTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAdminTheme requires ThemeProvider');
  return value;
}
