import type { ArData } from './types';

export type Series = 'invoice' | 'creditNote' | 'receipt';

/** Indian financial year label for a date, e.g. 2026-09-05 → '26-27', 2026-03-10 → '25-26'. */
export function fyLabel(date: string): string {
  const [y, m] = date.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  const two = (n: number) => String(n % 100).padStart(2, '0');
  return `${two(start)}-${two(start + 1)}`;
}

function prefixAndWidth(series: Series, date: string): [string, number] {
  const fy = fyLabel(date);
  if (series === 'invoice') return [`BWA/${fy}/`, 4];
  if (series === 'creditNote') return [`BWA/CN/${fy}/`, 3];
  return [`RCT/${fy}/`, 4];
}

/** R4: next number in a series for the financial year of `date`. Numbers are never reused. */
export function nextNumber(series: Series, data: ArData, date: string): string {
  const [prefix, width] = prefixAndWidth(series, date);
  const existing =
    series === 'invoice'
      ? data.invoices.map((i) => i.invoiceNo)
      : series === 'creditNote'
        ? data.creditNotes.map((c) => c.creditNoteNo)
        : data.receipts.map((r) => r.receiptNo);
  let max = 0;
  for (const no of existing) {
    if (!no.startsWith(prefix)) continue;
    const n = Number(no.slice(prefix.length));
    if (Number.isInteger(n) && n > max) max = n;
  }
  return prefix + String(max + 1).padStart(width, '0');
}
