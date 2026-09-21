import { loadArData } from '@/lib/ar/load';
import { parseAsOf } from '@/lib/asof';
import { plain, toCsv } from '@/lib/format';
import { invoiceRows } from '@/lib/invoiceList';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const asof = parseAsOf(p.get('asof') ?? undefined);
  const g = (k: string) => p.get(k) ?? '';
  const data = await loadArData();
  const rows = invoiceRows(data, asof, {
    customer: g('customer'), status: g('status') || 'all', disputed: g('disputed'), from: g('from'), to: g('to'),
    q: g('q'), sort: g('sort'), dir: g('dir'),
  });
  const csv = toCsv([
    ['Invoice no', 'Customer code', 'Customer', 'Invoice date', 'Due date', 'Total', 'Received', 'Credited', 'Outstanding', 'Status', 'Days late', 'Part-paid', 'Disputed'],
    ...rows.map((r) => [
      r.invoice.invoiceNo, r.customerCode, r.customerName, r.invoice.invoiceDate, r.invoice.dueDate, plain(r.invoice.total),
      r.pos ? plain(r.pos.received) : '', r.pos ? plain(r.pos.credited) : '', r.pos ? plain(r.pos.outstanding) : '',
      r.status, r.status === 'Overdue' ? r.pos!.daysPastDue : '', r.pos?.isPartPaid ? 'Yes' : 'No', r.invoice.isDisputed ? 'Yes' : 'No',
    ]),
  ]);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Invoices_${asof}.csv"`,
    },
  });
}
