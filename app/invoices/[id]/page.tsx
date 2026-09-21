import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadArData } from '@/lib/ar/load';
import { creditNoteGst, invoicePositions } from '@/lib/ar';
import { parseAsOf, type SP } from '@/lib/asof';
import { fmtDate, money } from '@/lib/format';
import { cancelInvoice, createCreditNote, setDisputed } from '@/lib/actions/invoices';
import { removeAllocation } from '@/lib/actions/receipts';
import NoteForm from '@/components/NoteForm';
import NotesTimeline from '@/components/NotesTimeline';
import { btn, btnDanger, btnLight, Card, Field, Flash, input, Label, PageTitle, StatusBadge, Table, td, tdR, th, thR } from '@/components/ui';

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const data = await loadArData();
  const inv = data.invoices.find((i) => i.id === Number(id));
  if (!inv) notFound();
  const customer = data.customers.find((c) => c.id === inv.customerId)!;
  const here = `/invoices/${inv.id}?asof=${asof}`;
  const pos = invoicePositions(data, asof).find((p) => p.invoice.id === inv.id) ?? null;
  const allTime = invoicePositions(data, '9999-12-31').find((p) => p.invoice.id === inv.id) ?? null;

  const allocs = data.allocations.filter((a) => a.invoiceId === inv.id).sort((a, b) => (a.allocationDate < b.allocationDate ? -1 : 1));
  const cns = data.creditNotes.filter((c) => c.invoiceId === inv.id);
  const receiptNo = new Map(data.receipts.map((r) => [r.id, r.receiptNo]));
  const notes = data.notes.filter((n) => n.invoiceId === inv.id);
  const canCancel = !inv.isCancelled && allocs.length === 0 && cns.length === 0;
  const status = inv.isCancelled ? 'Cancelled' : pos?.status;
  const maxCnTaxable = allTime ? Math.floor((allTime.outstanding * 100) / (100 + inv.gstRatePct)) : 0;
  const sample = creditNoteGst(inv, 100_00);

  return (
    <div className="space-y-6">
      <PageTitle
        title={`Invoice ${inv.invoiceNo}`}
        sub={<><Link className="text-blue-700 hover:underline" href={`/customers/${customer.id}?asof=${asof}`}>{customer.name}</Link> · {inv.description}</>}
        actions={
          !inv.isCancelled && (
            <>
              <form action={setDisputed}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="disputed" value={String(!inv.isDisputed)} />
                <input type="hidden" name="back" value={here} />
                <button className={btnLight}>{inv.isDisputed ? 'Clear disputed flag' : 'Mark as disputed'}</button>
              </form>
              <form action={cancelInvoice}>
                <input type="hidden" name="id" value={inv.id} />
                <input type="hidden" name="back" value={here} />
                <button className={btnDanger} disabled={!canCancel} title={canCancel ? '' : 'Has payments or credit notes against it'}>
                  Cancel invoice
                </button>
              </form>
            </>
          )
        }
      />
      <Flash error={sp.error as string} ok={sp.ok as string} />
      {inv.invoiceDate > asof && (
        <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This invoice is dated {fmtDate(inv.invoiceDate)}, after the as-at date, so it does not exist yet at {fmtDate(asof)}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Tax breakdown">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-slate-500">Invoice date</dt><dd>{fmtDate(inv.invoiceDate)}</dd>
            <dt className="text-slate-500">Due date</dt><dd>{fmtDate(inv.dueDate)}</dd>
            <dt className="text-slate-500">Taxable value</dt><dd className="tabular-nums">{money(inv.taxableValue)}</dd>
            {inv.igst ? (
              <><dt className="text-slate-500">IGST @ {inv.gstRatePct}%</dt><dd className="tabular-nums">{money(inv.igst)}</dd></>
            ) : (
              <>
                <dt className="text-slate-500">CGST @ {inv.gstRatePct / 2}%</dt><dd className="tabular-nums">{money(inv.cgst)}</dd>
                <dt className="text-slate-500">SGST @ {inv.gstRatePct / 2}%</dt><dd className="tabular-nums">{money(inv.sgst)}</dd>
              </>
            )}
            <dt className="font-semibold">Total</dt><dd className="font-semibold tabular-nums">{money(inv.total)}</dd>
          </dl>
        </Card>
        <Card title={`Position as at ${fmtDate(asof)}`}>
          {status && (
            <p className="mb-2">
              <StatusBadge status={status} />
              {pos?.isPartPaid && <Label tone="slate">part-paid</Label>}
              {inv.isDisputed && <Label>disputed</Label>}
              {pos?.status === 'Overdue' && <span className="ml-2 text-sm text-red-700">{pos.daysPastDue} days late · bucket {pos.bucket}</span>}
            </p>
          )}
          {pos && (
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-slate-500">Total</dt><dd className="tabular-nums">{money(inv.total)}</dd>
              <dt className="text-slate-500">Received</dt><dd className="tabular-nums">{money(pos.received)}</dd>
              <dt className="text-slate-500">Credited</dt><dd className="tabular-nums">{money(pos.credited)}</dd>
              <dt className="font-semibold">Outstanding</dt><dd className="font-semibold tabular-nums">{money(pos.outstanding)}</dd>
            </dl>
          )}
          {inv.isCancelled && <p className="text-sm text-slate-500">Cancelled invoices are left out of every total.</p>}
        </Card>
      </div>

      <Card title="Allocations (payments applied)">
        <Table>
          <thead><tr><th className={th}>Receipt</th><th className={th}>Allocation date</th><th className={thR}>Amount</th><th className={th} /></tr></thead>
          <tbody>
            {allocs.map((a) => (
              <tr key={a.id} className={a.allocationDate > asof ? 'text-slate-400' : ''}>
                <td className={td}>{receiptNo.get(a.receiptId)}</td>
                <td className={td}>{fmtDate(a.allocationDate)}{a.allocationDate > asof && ' (after as-at date)'}</td>
                <td className={tdR}>{money(a.amount)}</td>
                <td className={td}>
                  <form action={removeAllocation}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="back" value={here} />
                    <button className={`${btnDanger} px-2 py-0.5 text-xs`}>Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {!allocs.length && <tr><td className={td} colSpan={4}>No payments allocated.</td></tr>}
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Credit notes">
          <Table>
            <thead><tr><th className={th}>Number</th><th className={th}>Date</th><th className={thR}>Taxable</th><th className={thR}>GST</th><th className={thR}>Total</th></tr></thead>
            <tbody>
              {cns.map((c) => (
                <tr key={c.id} className={c.creditNoteDate > asof ? 'text-slate-400' : ''}>
                  <td className={td}>{c.creditNoteNo}<span className="block text-xs text-slate-500">{c.reason}</span></td>
                  <td className={td}>{fmtDate(c.creditNoteDate)}</td>
                  <td className={tdR}>{money(c.taxableValue)}</td>
                  <td className={tdR}>{money(c.cgst + c.sgst + c.igst)}</td>
                  <td className={tdR}>{money(c.total)}</td>
                </tr>
              ))}
              {!cns.length && <tr><td className={td} colSpan={5}>None.</td></tr>}
            </tbody>
          </Table>
        </Card>
        {!inv.isCancelled && allTime && allTime.outstanding > 0 && (
          <Card title="Raise a credit note">
            <form action={createCreditNote} className="grid gap-3 text-sm md:grid-cols-2">
              <input type="hidden" name="invoiceId" value={inv.id} />
              <input type="hidden" name="back" value={here} />
              <Field label="Date"><input type="date" name="creditNoteDate" defaultValue={asof < inv.invoiceDate ? inv.invoiceDate : asof} min={inv.invoiceDate} className={input} required /></Field>
              <Field label="Taxable value (₹)" hint={`GST added at ${inv.gstRatePct}% as ${sample.igst ? 'IGST' : 'CGST + SGST'}. Max about ${money(maxCnTaxable)}.`}>
                <input name="taxable" inputMode="decimal" className={input} required />
              </Field>
              <div className="md:col-span-2"><Field label="Reason"><input name="reason" className={input} required /></Field></div>
              <div className="md:col-span-2"><button className={btn}>Raise credit note</button></div>
            </form>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Notes"><NotesTimeline notes={notes} data={data} asof={asof} back={here} /></Card>
        <Card title="Add a note on this invoice"><NoteForm customerId={customer.id} invoiceId={inv.id} asof={asof} back={here} /></Card>
      </div>
    </div>
  );
}
