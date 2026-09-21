'use client';

import { useState } from 'react';

interface Row { id: number; invoiceNo: string; invoiceDate: string; dueDate: string; outstanding: number; suggested: number }

const fmt = (p: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(p / 100);
const toPaise = (s: string) => {
  const t = s.replace(/[₹,\s]/g, '');
  return /^\d+(\.\d{0,2})?$/.test(t) ? Math.round(Number(t) * 100) : t === '' ? 0 : NaN;
};

/** Editable oldest-first allocation with a live "remains unapplied" figure. */
export default function AllocationTable({ rows, settlement }: { rows: Row[]; settlement: number }) {
  const [vals, setVals] = useState<Record<number, string>>(
    Object.fromEntries(rows.map((r) => [r.id, r.suggested ? (r.suggested / 100).toFixed(2) : ''])),
  );
  const amounts = rows.map((r) => toPaise(vals[r.id] ?? ''));
  const bad = amounts.some((a, i) => Number.isNaN(a) || a > rows[i].outstanding);
  const allocated = amounts.reduce((s, a) => s + (Number.isNaN(a) ? 0 : a), 0);
  const left = settlement - allocated;

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase text-slate-600 dark:text-slate-400">
            <th className="px-2 py-2">Invoice</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">Due</th>
            <th className="px-2 py-2 text-right">Outstanding</th><th className="px-2 py-2 text-right">Allocate (₹)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-2 py-1.5">{r.invoiceNo}</td>
              <td className="px-2 py-1.5">{r.invoiceDate}</td>
              <td className="px-2 py-1.5">{r.dueDate}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{fmt(r.outstanding)}</td>
              <td className="px-2 py-1.5 text-right">
                <input
                  name={`alloc_${r.id}`}
                  value={vals[r.id] ?? ''}
                  onChange={(e) => setVals({ ...vals, [r.id]: e.target.value })}
                  inputMode="decimal"
                  className={`w-32 rounded border bg-white px-2 py-1 text-right dark:bg-slate-800 ${Number.isNaN(amounts[i]) || amounts[i] > r.outstanding ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'}`}
                />
                <button type="button" className="ml-1 text-xs text-blue-700 dark:text-blue-400 underline"
                  onClick={() => setVals({ ...vals, [r.id]: (Math.max(0, Math.min(r.outstanding, left + (Number.isNaN(amounts[i]) ? 0 : amounts[i]))) / 100).toFixed(2) })}>
                  fill
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap gap-6 text-sm">
        <span>Settlement value: <b>{fmt(settlement)}</b></span>
        <span>Allocated: <b>{fmt(allocated)}</b></span>
        <span className={left < 0 ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
          Remains unapplied: <b>{fmt(left)}</b>{left < 0 && ' (over-allocated)'}
        </span>
        <button type="button" className="text-blue-700 dark:text-blue-400 underline" onClick={() => setVals(Object.fromEntries(rows.map((r) => [r.id, ''])))}>
          Clear all
        </button>
      </div>
      {bad && <p className="mt-2 text-sm text-red-700 dark:text-red-400">An amount is not a number or is more than the invoice&apos;s outstanding.</p>}
    </div>
  );
}
