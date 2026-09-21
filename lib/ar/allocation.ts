import type { ArData, Paise } from './types';
import { invoicePositions, type InvoicePosition } from './positions';

/**
 * Open invoices of a customer as at a date, oldest first (by due date, then invoice number).
 * Uses every allocation and credit note regardless of date, because a new allocation must fit
 * within what is outstanding across all time, not only up to the as-at date.
 */
export function openInvoices(data: ArData, customerId: number, onDate: string): InvoicePosition[] {
  return invoicePositions(data, '9999-12-31')
    .filter((p) => p.invoice.customerId === customerId && p.outstanding > 0 && p.invoice.invoiceDate <= onDate)
    .sort((a, b) =>
      a.invoice.dueDate !== b.invoice.dueDate
        ? a.invoice.dueDate < b.invoice.dueDate ? -1 : 1
        : a.invoice.invoiceNo < b.invoice.invoiceNo ? -1 : 1,
    );
}

/** R6: suggest allocating `amount` to the open invoices oldest first. */
export function suggestAllocation(open: InvoicePosition[], amount: Paise): Map<number, Paise> {
  const out = new Map<number, Paise>();
  let left = amount;
  for (const p of open) {
    if (left <= 0) break;
    const take = Math.min(left, p.outstanding);
    out.set(p.invoice.id, take);
    left -= take;
  }
  return out;
}

/** All-time unapplied balance of a receipt (settlement − every allocation from it). */
export function receiptUnapplied(data: ArData, receiptId: number): Paise {
  const r = data.receipts.find((x) => x.id === receiptId);
  if (!r) return 0;
  const allocated = data.allocations.filter((a) => a.receiptId === receiptId).reduce((s, a) => s + a.amount, 0);
  return r.bankAmount + r.tdsAmount - allocated;
}
