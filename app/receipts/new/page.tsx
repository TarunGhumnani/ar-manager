import { loadArData } from '@/lib/ar/load';
import { isValidDate, nextNumber, openInvoices, RECEIPT_MODES, suggestAllocation } from '@/lib/ar';
import { one, parseAsOf, type SP } from '@/lib/asof';
import { fmtDate, money, parseRupees, plain } from '@/lib/format';
import { recordPayment } from '@/lib/actions/receipts';
import AllocationTable from '@/components/AllocationTable';
import { btn, btnLight, Card, Field, Flash, input, PageTitle } from '@/components/ui';

export default async function NewReceipt({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const data = await loadArData();

  const customerId = one(sp.customer);
  const date = one(sp.date) || asof;
  const bankRaw = one(sp.bank);
  const tdsRaw = one(sp.tds);
  const mode = one(sp.mode) || 'NEFT';
  const reference = one(sp.reference);
  const customer = data.customers.find((c) => String(c.id) === customerId);
  const bank = parseRupees(bankRaw);
  const open = customer && isValidDate(date) ? openInvoices(data, customer.id, date) : [];

  // R5: pre-fill the expected TDS (customer's rate on the taxable value) for the invoices the bank amount clears, oldest first.
  let expectedTds = 0;
  if (customer && bank !== null && bank > 0) {
    let bankLeft = bank;
    for (const p of open) {
      const share = p.outstanding / p.invoice.total;
      const tds = Math.round(((p.invoice.taxableValue * customer.tdsRatePct) / 100) * share);
      const cashNeeded = p.outstanding - tds;
      if (bankLeft < cashNeeded) break;
      bankLeft -= cashNeeded;
      expectedTds += tds;
    }
  }
  const tds = tdsRaw !== '' ? parseRupees(tdsRaw) : expectedTds;
  const ready = !!customer && isValidDate(date) && bank !== null && bank >= 0 && tds !== null && tds >= 0 && bank + tds > 0;
  const settlement = ready ? bank! + tds! : 0;
  const suggestion = ready ? suggestAllocation(open, settlement) : new Map<number, number>();
  const back = `/receipts/new?${new URLSearchParams({ asof, customer: customerId, date, bank: bankRaw, tds: tdsRaw, mode, reference })}`;

  return (
    <div className="space-y-6">
      <PageTitle title="Record a payment" sub="Settlement value = bank amount + TDS deducted by the customer." />
      <Flash error={sp.error as string} />
      <Card title="1. Receipt details">
        <form className="grid max-w-4xl gap-4 md:grid-cols-3">
          <input type="hidden" name="asof" value={asof} />
          <Field label="Customer">
            <select name="customer" defaultValue={customerId} className={input} required>
              <option value="">Choose…</option>
              {data.customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}{c.isActive ? '' : ' (inactive)'}</option>)}
            </select>
          </Field>
          <Field label="Receipt date"><input type="date" name="date" defaultValue={date} className={input} required /></Field>
          <Field label="Bank amount (₹)"><input name="bank" defaultValue={bankRaw} inputMode="decimal" className={input} required /></Field>
          <Field label="TDS deducted (₹)" hint={customer ? `Pre-filled at ${customer.tdsRatePct}% of taxable value. Enter what was actually deducted.` : 'Leave blank to pre-fill'}>
            <input name="tds" defaultValue={tdsRaw !== '' ? tdsRaw : ready || expectedTds ? plain(expectedTds) : ''} inputMode="decimal" className={input} />
          </Field>
          <Field label="Mode">
            <select name="mode" defaultValue={mode} className={input}>{RECEIPT_MODES.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
          <Field label="Reference (UTR / UPI / cheque no.)"><input name="reference" defaultValue={reference} className={input} /></Field>
          <div className="md:col-span-3"><button className={btnLight}>Show open invoices and suggest allocation</button></div>
        </form>
      </Card>

      {ready && customer && (
        <Card title={`2. Allocate to ${customer.name}'s open invoices (oldest first)`}>
          <p className="mb-3 text-sm text-slate-600">
            Receipt {nextNumber('receipt', data, date)} · {fmtDate(date)} · bank {money(bank!)} + TDS {money(tds!)} = <b>{money(settlement)}</b>.
            Edit the suggestion as needed; anything not allocated stays as unapplied credit.
          </p>
          <form action={recordPayment}>
            <input type="hidden" name="asof" value={asof} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="customerId" value={customer.id} />
            <input type="hidden" name="receiptDate" value={date} />
            <input type="hidden" name="bank" value={plain(bank!)} />
            <input type="hidden" name="tds" value={plain(tds!)} />
            <input type="hidden" name="mode" value={mode} />
            <input type="hidden" name="reference" value={reference} />
            {open.length ? (
              <AllocationTable
                settlement={settlement}
                rows={open.map((p) => ({
                  id: p.invoice.id, invoiceNo: p.invoice.invoiceNo, invoiceDate: fmtDate(p.invoice.invoiceDate),
                  dueDate: fmtDate(p.invoice.dueDate), outstanding: p.outstanding, suggested: suggestion.get(p.invoice.id) ?? 0,
                }))}
              />
            ) : (
              <p className="text-sm text-slate-600">No open invoices dated on or before {fmtDate(date)}. The whole amount will be kept as unapplied credit (an advance).</p>
            )}
            {!reference && <p className="mt-3 text-sm text-red-700">Enter a reference in step 1 before saving.</p>}
            <button className={`${btn} mt-4`} disabled={!reference}>Save receipt and allocations</button>
          </form>
        </Card>
      )}
    </div>
  );
}
