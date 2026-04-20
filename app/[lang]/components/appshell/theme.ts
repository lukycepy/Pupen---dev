export type AppTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pupen_theme';

export function readStoredTheme(): AppTheme | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'dark' || raw === 'light' ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: AppTheme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

export function applyThemeToDom(theme: AppTheme) {
  if (theme === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}

