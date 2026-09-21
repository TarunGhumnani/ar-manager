import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadArData } from '@/lib/ar/load';
import { BUCKETS, customerPositions, invoicePositions, openInvoices, receiptPositions, receiptUnapplied } from '@/lib/ar';
import { fyStart, parseAsOf, type SP } from '@/lib/asof';
import { balance, fmtDate, money, plain } from '@/lib/format';
import { setCustomerActive } from '@/lib/actions/customers';
import { allocateCredit, deleteReceipt } from '@/lib/actions/receipts';
import NoteForm from '@/components/NoteForm';
import NotesTimeline from '@/components/NotesTimeline';
import { btn, btnDanger, btnLight, Card, Flash, input, Label, PageTitle, StatusBadge, Table, td, tdR, th, thR } from '@/components/ui';

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const data = await loadArData();
  const pos = customerPositions(data, asof).find((p) => p.customer.id === Number(id));
  if (!pos) notFound();
  const c = pos.customer;
  const here = `/customers/${c.id}?asof=${asof}`;

  const invs = invoicePositions(data, asof).filter((p) => p.invoice.customerId === c.id).sort((a, b) => (a.invoice.invoiceDate < b.invoice.invoiceDate ? 1 : -1));
  const cancelled = data.invoices.filter((i) => i.customerId === c.id && i.isCancelled && i.invoiceDate <= asof);
  const recs = receiptPositions(data, asof).filter((r) => r.receipt.customerId === c.id).sort((a, b) => (a.receipt.receiptDate < b.receipt.receiptDate ? 1 : -1));
  const open = openInvoices(data, c.id, '9999-12-31');
  const notes = data.notes.filter((n) => n.customerId === c.id);
  const invNo = new Map(data.invoices.map((i) => [i.id, i.invoiceNo]));

  return (
    <div className="space-y-6">
      <PageTitle
        title={`${c.code} · ${c.name}`}
        sub={<>{c.city}, {c.state} · {c.isActive ? 'Active' : <span className="font-medium text-red-700 dark:text-red-400">Inactive</span>}</>}
        actions={
          <>
            {c.isActive && <Link className={btn} href={`/invoices/new?customer=${c.id}&asof=${asof}`}>New invoice</Link>}
            <Link className={btn} href={`/receipts/new?customer=${c.id}&asof=${asof}`}>Record payment</Link>
            <Link className={btnLight} href={`/statement?customer=${c.id}&from=${fyStart(asof)}&to=${asof}&asof=${asof}`}>Statement</Link>
            <Link className={btnLight} href={`/customers/${c.id}/edit?asof=${asof}`}>Edit</Link>
            <form action={setCustomerActive}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="active" value={String(!c.isActive)} />
              <input type="hidden" name="back" value={here} />
              <button className={c.isActive ? btnDanger : btnLight}>{c.isActive ? 'Deactivate' : 'Reactivate'}</button>
            </form>
          </>
        }
      />
      <Flash error={sp.error as string} ok={sp.ok as string} />
      {pos.overLimit && (
        <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          Over credit limit: net balance {balance(pos.netBalance)} against a limit of {money(c.creditLimit)}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profile">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Contact</dt><dd>{c.contactPerson}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Email</dt><dd>{c.email}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Phone</dt><dd>{c.phone || '—'}</dd>
            <dt className="text-slate-500 dark:text-slate-400">GSTIN</dt><dd>{c.gstin || '—'}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Credit days</dt><dd>{c.creditDays}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Credit limit</dt><dd>{money(c.creditLimit)}</dd>
            <dt className="text-slate-500 dark:text-slate-400">TDS rate</dt><dd>{c.tdsRatePct}%</dd>
          </dl>
        </Card>
        <Card title={`Balance as at ${fmtDate(asof)}`} className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div><div className="text-slate-500 dark:text-slate-400">Outstanding</div><div className="text-lg font-semibold">{money(pos.outstanding)}</div></div>
            <div><div className="text-slate-500 dark:text-slate-400">Unapplied credit</div><div className="text-lg font-semibold">{money(pos.unapplied)}</div></div>
            <div><div className="text-slate-500 dark:text-slate-400">Net balance</div><div className="text-lg font-semibold">{balance(pos.netBalance)}</div></div>
            <div><div className="text-slate-500 dark:text-slate-400">Overdue</div><div className="text-lg font-semibold text-red-700 dark:text-red-400">{money(pos.overdue)}</div></div>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {BUCKETS.map((b, i) => (
              <span key={b}>{i > 0 && ' · '}{b}: <span className={b !== 'Not due' && pos.buckets[b] ? 'font-medium text-red-700 dark:text-red-400' : ''}>{money(pos.buckets[b])}</span></span>
            ))}
          </p>
        </Card>
      </div>

      <Card title="Invoices">
        <Table>
          <thead><tr>
            <th className={th}>Invoice</th><th className={th}>Date</th><th className={th}>Due</th>
            <th className={thR}>Total</th><th className={thR}>Received</th><th className={thR}>Credited</th>
            <th className={thR}>Outstanding</th><th className={th}>Status</th><th className={thR}>Days late</th>
          </tr></thead>
          <tbody>
            {invs.map((p) => (
              <tr key={p.invoice.id} className={p.status === 'Overdue' ? 'bg-red-50 dark:bg-red-950/40' : ''}>
                <td className={td}><Link className="text-blue-700 dark:text-blue-400 hover:underline" href={`/invoices/${p.invoice.id}?asof=${asof}`}>{p.invoice.invoiceNo}</Link></td>
                <td className={td}>{fmtDate(p.invoice.invoiceDate)}</td>
                <td className={td}>{fmtDate(p.invoice.dueDate)}</td>
                <td className={tdR}>{money(p.invoice.total)}</td>
                <td className={tdR}>{money(p.received)}</td>
                <td className={tdR}>{money(p.credited)}</td>
                <td className={tdR}>{money(p.outstanding)}</td>
                <td className={td}>
                  <StatusBadge status={p.status} />
                  {p.isPartPaid && <Label tone="slate">part-paid</Label>}
                  {p.invoice.isDisputed && <Label>disputed</Label>}
                </td>
                <td className={tdR}>{p.status === 'Overdue' ? p.daysPastDue : ''}</td>
              </tr>
            ))}
            {cancelled.map((i) => (
              <tr key={i.id} className="text-slate-400 dark:text-slate-500">
                <td className={td}><Link href={`/invoices/${i.id}?asof=${asof}`}>{i.invoiceNo}</Link></td>
                <td className={td}>{fmtDate(i.invoiceDate)}</td><td className={td} /><td className={tdR}>{money(i.total)}</td>
                <td className={td} colSpan={3} /><td className={td}><StatusBadge status="Cancelled" /></td><td className={td} />
              </tr>
            ))}
            {!invs.length && !cancelled.length && <tr><td className={td} colSpan={9}>No invoices as at this date.</td></tr>}
          </tbody>
        </Table>
      </Card>

      <Card title="Receipts">
        <Table>
          <thead><tr>
            <th className={th}>Receipt</th><th className={th}>Date</th><th className={th}>Mode / ref</th>
            <th className={thR}>Bank</th><th className={thR}>TDS</th><th className={thR}>Settlement</th>
            <th className={thR}>Allocated</th><th className={thR}>Unapplied</th><th className={th}>Allocated to</th><th className={th} />
          </tr></thead>
          <tbody>
            {recs.map((r) => {
              const allocs = data.allocations.filter((a) => a.receiptId === r.receipt.id && a.allocationDate <= asof);
              const unappliedNow = receiptUnapplied(data, r.receipt.id);
              const hasAny = data.allocations.some((a) => a.receiptId === r.receipt.id);
              return (
                <tr key={r.receipt.id}>
                  <td className={td}>{r.receipt.receiptNo}</td>
                  <td className={td}>{fmtDate(r.receipt.receiptDate)}</td>
                  <td className={td}>{r.receipt.mode} · {r.receipt.reference}</td>
                  <td className={tdR}>{money(r.receipt.bankAmount)}</td>
                  <td className={tdR}>{money(r.receipt.tdsAmount)}</td>
                  <td className={tdR}>{money(r.settlement)}</td>
                  <td className={tdR}>{money(r.allocated)}</td>
                  <td className={`${tdR} ${r.unapplied ? 'font-semibold text-amber-700 dark:text-amber-400' : ''}`}>{money(r.unapplied)}</td>
                  <td className={`${td} text-xs`}>
                    {allocs.map((a) => <div key={a.id}>{invNo.get(a.invoiceId)} · {money(a.amount)} · {fmtDate(a.allocationDate)}</div>)}
                  </td>
                  <td className={td}>
                    {!hasAny && (
                      <form action={deleteReceipt}>
                        <input type="hidden" name="id" value={r.receipt.id} />
                        <input type="hidden" name="back" value={here} />
                        <button className={`${btnDanger} px-2 py-0.5 text-xs`}>Delete</button>
                      </form>
                    )}
                    {unappliedNow > 0 && open.length > 0 && (
                      <form action={allocateCredit} className="mt-1 flex flex-wrap items-center gap-1">
                        <input type="hidden" name="receiptId" value={r.receipt.id} />
                        <input type="hidden" name="back" value={here} />
                        <select name="invoiceId" className={`${input} w-40 text-xs`} required>
                          {open.map((p) => <option key={p.invoice.id} value={p.invoice.id}>{p.invoice.invoiceNo} ({money(p.outstanding)})</option>)}
                        </select>
                        <input name="amount" defaultValue={plain(Math.min(unappliedNow, open[0].outstanding))} className={`${input} w-28 text-xs`} />
                        <input type="date" name="allocationDate" defaultValue={asof} className={`${input} w-36 text-xs`} />
                        <button className={`${btn} px-2 py-1 text-xs`}>Allocate</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!recs.length && <tr><td className={td} colSpan={10}>No receipts as at this date.</td></tr>}
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Notes"><NotesTimeline notes={notes} data={data} asof={asof} back={here} /></Card>
        <Card title="Add a note">
          <NoteForm customerId={c.id} asof={asof} back={here}
            invoices={data.invoices.filter((i) => i.customerId === c.id && !i.isCancelled).map((i) => ({ id: i.id, invoiceNo: i.invoiceNo }))} />
        </Card>
      </div>
    </div>
  );
}
