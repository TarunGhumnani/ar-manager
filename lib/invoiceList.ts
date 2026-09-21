import { invoicePositions, type ArData, type Invoice, type InvoicePosition } from './ar';
import { sortRows } from './sort';

export interface InvoiceRow {
  invoice: Invoice;
  customerName: string;
  customerCode: string;
  pos: InvoicePosition | null; // null for cancelled invoices
  status: 'Paid' | 'Due' | 'Overdue' | 'Cancelled';
}

export interface InvoiceFilter {
  customer: string;
  status: string; // all | open | Paid | Due | Overdue | Cancelled
  disputed: string; // '' | yes | no
  from: string;
  to: string;
  q: string;
  sort: string;
  dir: string;
}

/** The invoice list as at a date, filtered and sorted. Shared by the page and the CSV export. */
export function invoiceRows(data: ArData, asof: string, f: InvoiceFilter): InvoiceRow[] {
  const posById = new Map(invoicePositions(data, asof).map((p) => [p.invoice.id, p]));
  const cust = new Map(data.customers.map((c) => [c.id, c]));
  let rows: InvoiceRow[] = data.invoices
    .filter((i) => i.invoiceDate <= asof)
    .map((i) => {
      const pos = posById.get(i.id) ?? null;
      return {
        invoice: i,
        customerName: cust.get(i.customerId)?.name ?? '',
        customerCode: cust.get(i.customerId)?.code ?? '',
        pos,
        status: i.isCancelled ? 'Cancelled' : pos!.status,
      };
    });
  rows = rows.filter((r) => {
    if (f.customer && String(r.invoice.customerId) !== f.customer) return false;
    if (f.status === 'open' && !(r.status === 'Due' || r.status === 'Overdue')) return false;
    if (f.status && f.status !== 'all' && f.status !== 'open' && r.status !== f.status) return false;
    if (f.disputed === 'yes' && !r.invoice.isDisputed) return false;
    if (f.disputed === 'no' && r.invoice.isDisputed) return false;
    if (f.from && r.invoice.invoiceDate < f.from) return false;
    if (f.to && r.invoice.invoiceDate > f.to) return false;
    if (f.q && !r.invoice.invoiceNo.toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });
  return sortRows(rows, {
    no: (r) => r.invoice.invoiceNo, customer: (r) => r.customerName, date: (r) => r.invoice.invoiceDate,
    due: (r) => r.invoice.dueDate, total: (r) => r.invoice.total, received: (r) => r.pos?.received ?? null,
    credited: (r) => r.pos?.credited ?? null, outstanding: (r) => r.pos?.outstanding ?? null, status: (r) => r.status,
    late: (r) => (r.status === 'Overdue' ? r.pos!.daysPastDue : null),
  }, f.sort || 'no', f.dir || 'asc');
}

/** Totals exclude cancelled invoices (R8). */
export function invoiceTotals(rows: InvoiceRow[]) {
  const live = rows.filter((r) => r.pos);
  return {
    total: live.reduce((s, r) => s + r.invoice.total, 0),
    received: live.reduce((s, r) => s + r.pos!.received, 0),
    credited: live.reduce((s, r) => s + r.pos!.credited, 0),
    outstanding: live.reduce((s, r) => s + r.pos!.outstanding, 0),
  };
}
