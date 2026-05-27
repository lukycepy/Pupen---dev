'use client';

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { AppTheme, ResolvedTheme } from './theme';
import { applyThemeToDom, readStoredTheme, resolveTheme, writeStoredTheme } from './theme';

export default function ThemeToggleButton({
  className,
  testId = 'accessibility-theme-toggle',
}: {
  className?: string;
  testId?: string;
}) {
  const [preference, setPreference] = React.useState<AppTheme>('system');
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
    const stored = (readStoredTheme() || 'system') satisfies AppTheme;
    const next: AppTheme = stored === 'light' ? 'dark' : stored === 'dark' ? 'system' : 'light';
    writeStoredTheme(next);
    applyThemeToDom(next);
    setPreference(next);
    setResolved(resolveTheme(next));
  };

  const icon = preference === 'system' ? <Monitor size={18} /> : resolved === 'dark' ? <Sun size={18} /> : <Moon size={18} />;
  const title = preference === 'system' ? 'Režim: systém' : resolved === 'dark' ? 'Režim: tmavý' : 'Režim: světlý';

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ||
        'h-10 w-10 flex items-center justify-center rounded-xl bg-stone-50 text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-all border border-stone-100 shadow-sm dark:bg-stone-900 dark:text-stone-200 dark:border-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-50'
      }
      aria-label="Přepnout režim (světlý / tmavý / systém)"
      title={title}
      data-testid={testId}
    >
      {icon}
    </button>
  );
}
