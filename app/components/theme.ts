export type AppTheme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pupen_theme';

export function readStoredTheme(): AppTheme | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'dark' || raw === 'light' || raw === 'system' ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: AppTheme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {}
}

export function getSystemTheme(): ResolvedTheme {
  if (!window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(theme: AppTheme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function applyThemeToDom(theme: AppTheme) {
  const resolved = resolveTheme(theme);
  if (resolved === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
  (document.documentElement.style as any).colorScheme = resolved;
}

export function onSystemThemeChange(onChange: (resolved: ResolvedTheme) => void) {
  if (!window.matchMedia) return () => {};
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange(media.matches ? 'dark' : 'light');
  if (typeof media.addEventListener === 'function') media.addEventListener('change', handler);
  else (media as any).addListener?.(handler);
  return () => {
    if (typeof media.removeEventListener === 'function') media.removeEventListener('change', handler);
    else (media as any).removeListener?.(handler);
  };
}
