'use client';

export default function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-block rounded bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-sm text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-300">
      Print
    </button>
  );
}
