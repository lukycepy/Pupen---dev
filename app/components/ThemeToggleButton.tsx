'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import type { AppTheme, ResolvedTheme } from './theme';
import { applyThemeToDom, readStoredTheme, resolveTheme, writeStoredTheme } from './theme';

export default function ThemeToggleButton({
  className,
  testId = 'accessibility-theme-toggle',
}: {
  className?: string;
  testId?: string;
}) {
  const [, setPreference] = React.useState<AppTheme>('system');
  const [resolved, setResolved] = React.useState<ResolvedTheme>('light');

  React.useEffect(() => {
    const update = () => {
      const pref = (readStoredTheme() || 'system') satisfies AppTheme;
      setPreference(pref);
      setResolved(resolveTheme(pref));
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme-preference'] });
    return () => obs.disconnect();
  }, []);

  const toggle = () => {
    const next: AppTheme = resolved === 'dark' ? 'light' : 'dark';
    writeStoredTheme(next);
    applyThemeToDom(next);
    setPreference(next);
    setResolved(resolveTheme(next));
  };

  const icon = resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />;
  const title = resolved === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim';

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ||
        'inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-black bg-black text-white transition-all hover:border-green-600 hover:bg-green-600 hover:text-white dark:border-white dark:bg-white dark:text-black dark:hover:border-green-500 dark:hover:bg-green-500 dark:hover:text-black'
      }
      aria-label={title}
      title={title}
      data-testid={testId}
    >
      {icon}
    </button>
  );
}
