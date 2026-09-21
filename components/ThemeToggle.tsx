'use client';

import { useSyncExternalStore } from 'react';
import { THEME_KEY, type Theme } from '@/lib/theme';

const listeners = new Set<() => void>();

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch {
    return 'system';
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function setTheme(t: Theme) {
  try {
    if (t === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    // storage blocked (private mode): the choice still applies for this page view
  }
  const apply = (window as unknown as { __applyTheme?: () => void }).__applyTheme;
  if (apply) apply();
  else document.documentElement.classList.toggle('dark', t === 'dark');
  listeners.forEach((l) => l());
}

const OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: '☀' },
  { value: 'dark', label: 'Dark', icon: '☾' },
  { value: 'system', label: 'Auto', icon: '◐' },
];

/** Light / Dark / Auto (follow the computer's setting). */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'system' as Theme);
  return (
    <div role="radiogroup" aria-label="Colour theme" className="flex rounded border border-slate-300 text-xs dark:border-slate-600">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={theme === o.value}
          title={o.value === 'system' ? 'Follow my computer’s setting' : `${o.label} theme`}
          onClick={() => setTheme(o.value)}
          className={`px-2 py-1 first:rounded-l last:rounded-r ${
            theme === o.value
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <span aria-hidden>{o.icon}</span> {o.label}
        </button>
      ))}
    </div>
  );
}
