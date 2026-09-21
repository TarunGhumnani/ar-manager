import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageTitle({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {sub && <p className="text-sm text-slate-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  );
}

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <div
      role="alert"
      className={`mb-4 rounded border px-3 py-2 text-sm print:hidden ${
        error ? 'border-red-300 bg-red-50 text-red-800' : 'border-green-300 bg-green-50 text-green-800'
      }`}
    >
      {error ?? ok}
    </div>
  );
}

export function Card({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 ${className}`}>
      {title && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h2>}
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'red' | 'green' }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-green-700' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

export const btn = 'inline-block rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700';
export const btnLight = 'inline-block rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50';
export const btnDanger = 'inline-block rounded border border-red-300 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50';
export const input = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm';
export const th = 'px-2 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 whitespace-nowrap';
export const thR = th + ' text-right';
export const td = 'px-2 py-1.5 align-top';
export const tdR = 'px-2 py-1.5 text-right tabular-nums whitespace-nowrap align-top';

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm [&_tbody_tr]:border-t [&_tbody_tr]:border-slate-100">{children}</table>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const c =
    status === 'Overdue' ? 'bg-red-100 text-red-800'
      : status === 'Paid' ? 'bg-green-100 text-green-800'
        : status === 'Cancelled' ? 'bg-slate-200 text-slate-600 line-through'
          : status === 'Broken' ? 'bg-red-100 text-red-800'
            : status === 'Kept' ? 'bg-green-100 text-green-800'
              : 'bg-blue-50 text-blue-800';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${c}`}>{status}</span>;
}

export function Label({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'slate' }) {
  const c = tone === 'amber' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700';
  return <span className={`ml-1 rounded px-1.5 py-0.5 text-xs ${c}`}>{children}</span>;
}

/** A column header that links to the same page sorted by `k`. */
export function SortTh({
  k, label, sort, dir, base, right,
}: { k: string; label: string; sort: string; dir: string; base: URLSearchParams; right?: boolean }) {
  const p = new URLSearchParams(base);
  const nextDir = sort === k && dir === 'asc' ? 'desc' : 'asc';
  p.set('sort', k);
  p.set('dir', nextDir);
  const arrow = sort === k ? (dir === 'asc' ? ' ▲' : ' ▼') : '';
  return (
    <th className={right ? thR : th}>
      <Link href={`?${p.toString()}`} className="hover:underline">
        {label}
        {arrow}
      </Link>
    </th>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
