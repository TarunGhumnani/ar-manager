import type { ArData, Paise } from './types';
import { addDays } from './dates';
import { balanceByDocuments, customerPositions, type BucketTotals } from './positions';

export type StatementLineKind = 'Invoice' | 'Credit note' | 'Receipt' | 'TDS';
const KIND_ORDER: Record<StatementLineKind, number> = { Invoice: 0, 'Credit note': 1, Receipt: 2, TDS: 3 };

export interface StatementLine {
  date: string;
  kind: StatementLineKind;
  docNo: string;
  particulars: string;
  debit: Paise;
  credit: Paise;
  balance: Paise;
}

export interface Statement {
  customerId: number;
  from: string;
  to: string;
  opening: Paise;
  lines: StatementLine[];
  closing: Paise;
  buckets: BucketTotals;
  unapplied: Paise;
}

/** R15: statement of account for a customer from `from` to `to`, both inclusive. */
export function statement(data: ArData, customerId: number, from: string, to: string): Statement {
  const opening = balanceByDocuments(data, customerId, addDays(from, -1));
  const inRange = (d: string) => d >= from && d <= to;
  const raw: Omit<StatementLine, 'balance'>[] = [];

  const invoiceById = new Map(data.invoices.map((i) => [i.id, i]));
  for (const i of data.invoices) {
    if (i.customerId === customerId && !i.isCancelled && inRange(i.invoiceDate)) {
      raw.push({ date: i.invoiceDate, kind: 'Invoice', docNo: i.invoiceNo, particulars: i.description, debit: i.total, credit: 0 });
    }
  }
  for (const c of data.creditNotes) {
    const inv = invoiceById.get(c.invoiceId);
    if (inv && inv.customerId === customerId && inRange(c.creditNoteDate)) {
      raw.push({
        date: c.creditNoteDate, kind: 'Credit note', docNo: c.creditNoteNo,
        particulars: `Credit note against ${inv.invoiceNo}`, debit: 0, credit: c.total,
      });
    }
  }
  for (const r of data.receipts) {
    if (r.customerId !== customerId || !inRange(r.receiptDate)) continue;
    raw.push({ date: r.receiptDate, kind: 'Receipt', docNo: r.receiptNo, particulars: 'Payment received', debit: 0, credit: r.bankAmount });
    if (r.tdsAmount > 0) {
      raw.push({ date: r.receiptDate, kind: 'TDS', docNo: r.receiptNo, particulars: 'TDS deducted by you', debit: 0, credit: r.tdsAmount });
    }
  }

  raw.sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1)
      : a.kind !== b.kind ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
        : a.docNo < b.docNo ? -1 : a.docNo > b.docNo ? 1 : 0,
  );

  let bal = opening;
  const lines = raw.map((l) => {
    bal += l.debit - l.credit;
    return { ...l, balance: bal };
  });

  const pos = customerPositions(data, to).find((p) => p.customer.id === customerId);
  return {
    customerId, from, to, opening, lines, closing: bal,
    buckets: pos?.buckets ?? { 'Not due': 0, '1-30': 0, '31-60': 0, '61-90': 0, '91-180': 0, 'Over 180': 0 },
    unapplied: pos?.unapplied ?? 0,
  };
}
