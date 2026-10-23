export type AppTheme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'pupen_theme';
export const THEME_CHANGE_EVENT = 'pupen:themechange';

function canAccessWindow(): boolean {
  return typeof window !== 'undefined' && !!window.document;
}

export function readStoredTheme(): AppTheme | null {
  if (!canAccessWindow()) return null;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'dark' || raw === 'light' || raw === 'system' ? raw : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(theme: AppTheme) {
  if (!canAccessWindow()) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore QuotaExceeded / sandbox restrictions
  }
  try {
    window.dispatchEvent(new CustomEvent<{ theme: AppTheme }>(THEME_CHANGE_EVENT, {
      detail: { theme },
    }));
  } catch {
    // Older browsers – ignore
  }
}

export function getSystemTheme(): ResolvedTheme {
  if (!canAccessWindow() || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(theme: AppTheme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

export function applyThemeToDom(theme: AppTheme, opts?: { transition?: boolean }) {
  if (!canAccessWindow()) return;
  const resolved = resolveTheme(theme);
  const root = document.documentElement;

  const withTransition = opts?.transition !== false;
  if (withTransition) {
    root.classList.add('theme-transition');
  }

  try {
    if (resolved === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    try {
      root.dataset.theme = resolved;
    } catch {}
    try {
      root.dataset.themePreference = theme;
    } catch {}
    try {
      (root.style as any).colorScheme = resolved;
    } catch {}

    if (withTransition) {
      window.setTimeout(() => {
        try { root.classList.remove('theme-transition'); } catch {}
      }, 420);
    }
  } catch {
    // ignore DOM errors
  }
}

export function onSystemThemeChange(onChange: (resolved: ResolvedTheme) => void) {
  if (!canAccessWindow() || !window.matchMedia) return () => {};
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange(media.matches ? 'dark' : 'light');
  try {
    if (typeof media.addEventListener === 'function') media.addEventListener('change', handler);
    else (media as any).addListener?.(handler);
  } catch {}
  return () => {
    try {
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', handler);
      else (media as any).removeListener?.(handler);
    } catch {}
  };
}

export function onStorageThemeChange(onChange: (next: AppTheme) => void) {
  if (!canAccessWindow()) return () => {};
  const storageHandler = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY || e.newValue === e.oldValue) return;
    const v = e.newValue;
    if (v === 'dark' || v === 'light' || v === 'system') onChange(v);
  };
  const customHandler = (e: Event) => {
    const ce = e as CustomEvent<{ theme: AppTheme }>;
    if (ce?.detail?.theme) onChange(ce.detail.theme);
  };
  try { window.addEventListener('storage', storageHandler); } catch {}
  try { window.addEventListener(THEME_CHANGE_EVENT, customHandler as EventListener); } catch {}
  return () => {
    try { window.removeEventListener('storage', storageHandler); } catch {}
    try { window.removeEventListener(THEME_CHANGE_EVENT, customHandler as EventListener); } catch {}
  };
}
