import Link from 'next/link';
import { loadArData } from '@/lib/ar/load';
import { one, parseAsOf, type SP } from '@/lib/asof';
import { fmtDate, money } from '@/lib/format';
import { invoiceRows, invoiceTotals, type InvoiceFilter } from '@/lib/invoiceList';
import { btn, btnLight, Card, Flash, input, Label, PageTitle, SortTh, StatusBadge, Table, td, tdR } from '@/components/ui';

export default async function InvoicesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const f: InvoiceFilter = {
    customer: one(sp.customer), status: one(sp.status) || 'all', disputed: one(sp.disputed),
    from: one(sp.from), to: one(sp.to), q: one(sp.q).trim(), sort: one(sp.sort) || 'no', dir: one(sp.dir) || 'asc',
  };
  const data = await loadArData();
  const rows = invoiceRows(data, asof, f);
  const t = invoiceTotals(rows);

  const base = new URLSearchParams({ asof, customer: f.customer, status: f.status, disputed: f.disputed, from: f.from, to: f.to, q: f.q });
  const s = { sort: f.sort, dir: f.dir, base };
  const exportQs = new URLSearchParams(base);
  exportQs.set('sort', f.sort);
  exportQs.set('dir', f.dir);

  return (
    <div>
      <PageTitle
        title="Invoices"
        sub={`${rows.length} invoice(s) as at ${fmtDate(asof)}`}
        actions={
          <>
            <a className={btnLight} href={`/invoices/export?${exportQs.toString()}`}>Export CSV</a>
            <Link className={btn} href={`/invoices/new?asof=${asof}`}>New invoice</Link>
          </>
        }
      />
      <Flash error={sp.error as string} ok={sp.ok as string} />
      <Card>
        <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="asof" value={asof} />
          <input name="q" defaultValue={f.q} placeholder="Invoice number" className={`${input} w-40`} />
          <select name="customer" defaultValue={f.customer} className={`${input} w-56`}>
            <option value="">All customers</option>
            {data.customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
          </select>
          <select name="status" defaultValue={f.status} className={`${input} w-36`}>
            <option value="all">All statuses</option>
            <option value="open">Open (due + overdue)</option>
            <option>Overdue</option><option>Due</option><option>Paid</option><option>Cancelled</option>
          </select>
          <select name="disputed" defaultValue={f.disputed} className={`${input} w-36`}>
            <option value="">Disputed: any</option><option value="yes">Disputed only</option><option value="no">Not disputed</option>
          </select>
          <label className="flex items-center gap-1">From <input type="date" name="from" defaultValue={f.from} className={`${input} w-36`} /></label>
          <label className="flex items-center gap-1">To <input type="date" name="to" defaultValue={f.to} className={`${input} w-36`} /></label>
          <button className={btnLight}>Filter</button>
          <Link href={`/invoices?asof=${asof}`} className="text-blue-700 underline">Clear</Link>
        </form>
        <Table>
          <thead>
            <tr>
              <SortTh k="no" label="Number" {...s} />
              <SortTh k="customer" label="Customer" {...s} />
              <SortTh k="date" label="Date" {...s} />
              <SortTh k="due" label="Due" {...s} />
              <SortTh k="total" label="Total" right {...s} />
              <SortTh k="received" label="Received" right {...s} />
              <SortTh k="credited" label="Credited" right {...s} />
              <SortTh k="outstanding" label="Outstanding" right {...s} />
              <SortTh k="status" label="Status" {...s} />
              <SortTh k="late" label="Days late" right {...s} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoice.id} className={r.status === 'Overdue' ? 'bg-red-50 text-red-900' : r.status === 'Cancelled' ? 'text-slate-400' : ''}>
                <td className={td}><Link className="text-blue-700 hover:underline" href={`/invoices/${r.invoice.id}?asof=${asof}`}>{r.invoice.invoiceNo}</Link></td>
                <td className={td}>{r.customerName}</td>
                <td className={td}>{fmtDate(r.invoice.invoiceDate)}</td>
                <td className={td}>{fmtDate(r.invoice.dueDate)}</td>
                <td className={tdR}>{money(r.invoice.total)}</td>
                <td className={tdR}>{r.pos ? money(r.pos.received) : ''}</td>
                <td className={tdR}>{r.pos ? money(r.pos.credited) : ''}</td>
                <td className={tdR}>{r.pos ? money(r.pos.outstanding) : ''}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <StatusBadge status={r.status} />
                  {r.pos?.isPartPaid && <Label tone="slate">part-paid</Label>}
                  {r.invoice.isDisputed && <Label>disputed</Label>}
                </td>
                <td className={tdR}>{r.status === 'Overdue' ? r.pos!.daysPastDue : ''}</td>
              </tr>
            ))}
            {!rows.length && <tr><td className={td} colSpan={10}>No invoices match.</td></tr>}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 font-semibold">
            <tr>
              <td className={td} colSpan={4}>Total (excluding cancelled)</td>
              <td className={tdR}>{money(t.total)}</td>
              <td className={tdR}>{money(t.received)}</td>
              <td className={tdR}>{money(t.credited)}</td>
              <td className={tdR}>{money(t.outstanding)}</td>
              <td className={td} colSpan={2} />
            </tr>
          </tfoot>
        </Table>
      </Card>
    </div>
  );
}
