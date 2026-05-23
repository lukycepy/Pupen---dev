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
  const [resolved, setResolved] = React.useState<ResolvedTheme>('light');

  React.useEffect(() => {
    const update = () => {
      setResolved(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    };
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const toggle = () => {
    const stored = (readStoredTheme() || 'system') satisfies AppTheme;
    const current = resolveTheme(stored);
    const next: AppTheme = current === 'dark' ? 'light' : 'dark';
    writeStoredTheme(next);
    applyThemeToDom(next);
    setResolved(resolveTheme(next));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ||
        'h-10 w-10 flex items-center justify-center rounded-xl bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-all border border-stone-100 shadow-sm dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-50'
      }
      aria-label={resolved === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
      title={resolved === 'dark' ? 'Světlý režim' : 'Tmavý režim'}
      data-testid={testId}
    >
      {resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

