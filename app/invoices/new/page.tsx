import Link from 'next/link';
import { loadArData } from '@/lib/ar/load';
import { customerPositions, dueDate, gstSplit, isValidDate, nextNumber } from '@/lib/ar';
import { one, parseAsOf, type SP } from '@/lib/asof';
import { balance, fmtDate, money, parseRupees } from '@/lib/format';
import { createInvoice } from '@/lib/actions/invoices';
import { btn, btnLight, Card, Field, Flash, input, PageTitle } from '@/components/ui';

export default async function NewInvoice({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const data = await loadArData();
  const active = data.customers.filter((c) => c.isActive);

  const customerId = one(sp.customer);
  const date = one(sp.date) || asof;
  const description = one(sp.description);
  const taxableRaw = one(sp.taxable);
  const rate = one(sp.rate) || '18';
  const taxable = parseRupees(taxableRaw);
  const customer = active.find((c) => String(c.id) === customerId);
  const wantPreview = one(sp.preview) === '1';

  const problems: string[] = [];
  if (wantPreview) {
    if (!customer) problems.push('Choose an active customer.');
    if (!isValidDate(date)) problems.push('Enter a valid invoice date.');
    if (!description.trim()) problems.push('Enter a description.');
    if (taxable === null || taxable <= 0) problems.push('Enter a taxable value above zero.');
    if (!(Number(rate) >= 0 && Number(rate) <= 28)) problems.push('Enter a GST rate between 0 and 28.');
  }
  const canPreview = wantPreview && problems.length === 0 && customer && taxable;

  let preview = null;
  if (canPreview) {
    const gst = gstSplit(customer.state, taxable, Number(rate));
    const total = taxable + gst.cgst + gst.sgst + gst.igst;
    const current = customerPositions(data, '9999-12-31').find((p) => p.customer.id === customer.id)!;
    preview = {
      gst, total, due: dueDate(date, customer.creditDays), no: nextNumber('invoice', data, date),
      newBalance: current.netBalance + total, limit: customer.creditLimit,
    };
  }
  const back = `/invoices/new?${new URLSearchParams({ asof, customer: customerId, date, description, taxable: taxableRaw, rate, preview: '1' })}`;

  return (
    <div className="space-y-6">
      <PageTitle title="New invoice" sub="Enter the details, preview the tax and number, then save." />
      <Flash error={(sp.error as string) ?? (problems.length ? problems.join(' ') : undefined)} />
      <Card>
        <form className="grid max-w-3xl gap-4 md:grid-cols-2">
          <input type="hidden" name="asof" value={asof} />
          <input type="hidden" name="preview" value="1" />
          <Field label="Customer (active only)">
            <select name="customer" defaultValue={customerId} className={input} required>
              <option value="">Choose…</option>
              {active.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} ({c.state}, {c.creditDays} days)</option>)}
            </select>
          </Field>
          <Field label="Invoice date"><input type="date" name="date" defaultValue={date} className={input} required /></Field>
          <div className="md:col-span-2">
            <Field label="Description"><input name="description" defaultValue={description} className={input} required /></Field>
          </div>
          <Field label="Taxable value (₹)"><input name="taxable" defaultValue={taxableRaw} inputMode="decimal" className={input} required /></Field>
          <Field label="GST rate (%)"><input name="rate" type="number" step="0.01" min={0} max={28} defaultValue={rate} className={input} /></Field>
          <div className="md:col-span-2"><button className={btnLight}>Preview</button></div>
        </form>
      </Card>

      {preview && customer && (
        <Card title="Preview">
          <dl className="grid max-w-md grid-cols-2 gap-y-1 text-sm">
            <dt className="text-slate-500">Invoice number</dt><dd className="font-medium">{preview.no}</dd>
            <dt className="text-slate-500">Customer</dt><dd>{customer.name}</dd>
            <dt className="text-slate-500">Invoice date</dt><dd>{fmtDate(date)}</dd>
            <dt className="text-slate-500">Due date</dt><dd>{fmtDate(preview.due)} ({customer.creditDays} days)</dd>
            <dt className="text-slate-500">Taxable value</dt><dd className="tabular-nums">{money(taxable!)}</dd>
            {preview.gst.igst ? (
              <><dt className="text-slate-500">IGST @ {rate}%</dt><dd className="tabular-nums">{money(preview.gst.igst)}</dd></>
            ) : (
              <>
                <dt className="text-slate-500">CGST @ {Number(rate) / 2}%</dt><dd className="tabular-nums">{money(preview.gst.cgst)}</dd>
                <dt className="text-slate-500">SGST @ {Number(rate) / 2}%</dt><dd className="tabular-nums">{money(preview.gst.sgst)}</dd>
              </>
            )}
            <dt className="font-semibold">Total</dt><dd className="font-semibold tabular-nums">{money(preview.total)}</dd>
          </dl>
          {preview.newBalance > preview.limit && (
            <div className="mt-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Warning: this invoice takes {customer.name}&apos;s net balance to {balance(preview.newBalance)}, above the credit limit of{' '}
              {money(preview.limit)}. You can still save it.
            </div>
          )}
          <form action={createInvoice} className="mt-4 flex gap-2">
            <input type="hidden" name="asof" value={asof} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="hidden" name="invoiceDate" value={date} />
            <input type="hidden" name="description" value={description} />
            <input type="hidden" name="taxable" value={taxableRaw} />
            <input type="hidden" name="gstRate" value={rate} />
            <button className={btn}>Save invoice</button>
            <Link className={btnLight} href={`/invoices?asof=${asof}`}>Cancel</Link>
          </form>
        </Card>
      )}
    </div>
  );
}
