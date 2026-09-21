'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { isValidDate } from '@/lib/ar/dates';

const NAV = [
  { href: '/', label: 'Overdue at a glance' },
  { href: '/customers', label: 'Customers' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/receipts/new', label: 'Record payment' },
  { href: '/statement', label: 'Statement' },
];

export default function Header({ today }: { today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('asof');
  const asof = raw && isValidDate(raw) ? raw : today; // same fallback as lib/asof on the server

  function setAsOf(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set('asof', v);
    else next.delete('asof');
    next.delete('error');
    next.delete('ok');
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={`/?asof=${asof}`} className="font-semibold text-slate-900">
          AR Manager <span className="font-normal text-slate-500">· Brightwater Advisory</span>
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {NAV.map((n) => {
            const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={`${n.href}?asof=${asof}`}
                className={`rounded px-2 py-1 ${active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          As at
          <input
            type="date"
            value={asof}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-slate-900"
          />
          {asof !== today && (
            <button type="button" onClick={() => setAsOf(today)} className="text-xs text-blue-700 underline">
              Today
            </button>
          )}
        </label>
      </div>
    </header>
  );
}
