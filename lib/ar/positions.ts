import type { ArData, Customer, Invoice, Paise, Receipt } from './types';
import { addDays, daysBetween } from './dates';

export type Bucket = 'Not due' | '1-30' | '31-60' | '61-90' | '91-180' | 'Over 180';
export const BUCKETS: Bucket[] = ['Not due', '1-30', '31-60', '61-90', '91-180', 'Over 180'];

export interface InvoicePosition {
  invoice: Invoice;
  received: Paise;
  credited: Paise;
  outstanding: Paise;
  daysPastDue: number;
  status: 'Paid' | 'Due' | 'Overdue';
  isPartPaid: boolean;
  bucket: Bucket | null;
}

export function bucketFor(daysPastDue: number): Bucket {
  if (daysPastDue <= 0) return 'Not due';
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  if (daysPastDue <= 90) return '61-90';
  if (daysPastDue <= 180) return '91-180';
  return 'Over 180';
}

/** R11 + R12: the position of every live invoice at the end of asOf ('YYYY-MM-DD'). */
export function invoicePositions(data: ArData, asOf: string): InvoicePosition[] {
  const received = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) received.set(a.invoiceId, (received.get(a.invoiceId) ?? 0) + a.amount);
  }
  const credited = new Map<number, Paise>();
  for (const c of data.creditNotes) {
    if (c.creditNoteDate <= asOf) credited.set(c.invoiceId, (credited.get(c.invoiceId) ?? 0) + c.total);
  }
  return data.invoices
    .filter((i) => !i.isCancelled && i.invoiceDate <= asOf)
    .map((i) => {
      const rec = received.get(i.id) ?? 0;
      const cred = credited.get(i.id) ?? 0;
      const outstanding = i.total - rec - cred;
      const daysPastDue = daysBetween(i.dueDate, asOf);
      return {
        invoice: i,
        received: rec,
        credited: cred,
        outstanding,
        daysPastDue,
        status: outstanding === 0 ? 'Paid' : daysPastDue >= 1 ? 'Overdue' : 'Due',
        isPartPaid: outstanding > 0 && rec + cred > 0,
        bucket: outstanding === 0 ? null : bucketFor(daysPastDue),
      };
    });
}

export interface ReceiptPosition {
  receipt: Receipt;
  settlement: Paise;
  allocated: Paise;
  unapplied: Paise;
}

/** R5 + R13: every receipt dated on or before asOf, with what has been allocated from it by asOf. */
export function receiptPositions(data: ArData, asOf: string): ReceiptPosition[] {
  const allocated = new Map<number, Paise>();
  for (const a of data.allocations) {
    if (a.allocationDate <= asOf) allocated.set(a.receiptId, (allocated.get(a.receiptId) ?? 0) + a.amount);
  }
  return data.receipts
    .filter((r) => r.receiptDate <= asOf)
    .map((r) => {
      const settlement = r.bankAmount + r.tdsAmount;
      const alloc = allocated.get(r.id) ?? 0;
      return { receipt: r, settlement, allocated: alloc, unapplied: settlement - alloc };
    });
}

export type BucketTotals = Record<Bucket, Paise>;

export function emptyBuckets(): BucketTotals {
  return { 'Not due': 0, '1-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, 'Over 180': 0 };
}

export interface CustomerPosition {
  customer: Customer;
  buckets: BucketTotals;
  outstanding: Paise;
  unapplied: Paise;
  netBalance: Paise;
  overdue: Paise;
  overdueCount: number;
  overLimit: boolean;
  limitUsedPct: number | null;
}

/** R13: one entry per customer. */
export function customerPositions(data: ArData, asOf: string): CustomerPosition[] {
  const invs = invoicePositions(data, asOf);
  const recs = receiptPositions(data, asOf);
  return data.customers.map((customer) => {
    const buckets = emptyBuckets();
    let outstanding = 0;
    let overdueCount = 0;
    for (const p of invs) {
      if (p.invoice.customerId !== customer.id || p.bucket === null) continue;
      buckets[p.bucket] += p.outstanding;
      outstanding += p.outstanding;
      if (p.status === 'Overdue') overdueCount++;
    }
    let unapplied = 0;
    for (const r of recs) if (r.receipt.customerId === customer.id) unapplied += r.unapplied;
    const netBalance = outstanding - unapplied;
    return {
      customer,
      buckets,
      outstanding,
      unapplied,
      netBalance,
      overdue: outstanding - buckets['Not due'],
      overdueCount,
      overLimit: netBalance > customer.creditLimit,
      limitUsedPct: customer.creditLimit > 0 ? (netBalance / customer.creditLimit) * 100 : null,
    };
  });
}

/** R14: balance straight from the documents. */
export function balanceByDocuments(data: ArData, customerId: number, asOf: string): Paise {
  const invoiceIds = new Set<number>();
  let bal = 0;
  for (const i of data.invoices) {
    if (i.customerId !== customerId) continue;
    invoiceIds.add(i.id);
    if (!i.isCancelled && i.invoiceDate <= asOf) bal += i.total;
  }
  for (const c of data.creditNotes) if (invoiceIds.has(c.invoiceId) && c.creditNoteDate <= asOf) bal -= c.total;
  for (const r of data.receipts) {
    if (r.customerId === customerId && r.receiptDate <= asOf) bal -= r.bankAmount + r.tdsAmount;
  }
  return bal;
}

export interface BalanceDifference {
  customerId: number;
  code: string;
  netBalance: Paise;
  byDocuments: Paise;
}

/** R14 control check: only customers whose two balances differ. Must always be empty. */
export function balanceCheck(data: ArData, asOf: string): BalanceDifference[] {
  const out: BalanceDifference[] = [];
  for (const p of customerPositions(data, asOf)) {
    const byDocuments = balanceByDocuments(data, p.customer.id, asOf);
    if (byDocuments !== p.netBalance) {
      out.push({ customerId: p.customer.id, code: p.customer.code, netBalance: p.netBalance, byDocuments });
    }
  }
  return out;
}

/** R17: DSO in whole days, or null when there are no net sales in the 90-day window. */
export function dso(data: ArData, asOf: string): number | null {
  const outstanding = invoicePositions(data, asOf).reduce((s, p) => s + p.outstanding, 0);
  const from = addDays(asOf, -89);
  let sales = 0;
  for (const i of data.invoices) {
    if (!i.isCancelled && i.invoiceDate >= from && i.invoiceDate <= asOf) sales += i.total;
  }
  for (const c of data.creditNotes) if (c.creditNoteDate >= from && c.creditNoteDate <= asOf) sales -= c.total;
  if (sales === 0) return null;
  return Math.round((outstanding / sales) * 90);
}
