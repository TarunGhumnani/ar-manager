import { loadArData } from '@/lib/ar/load';
import { BUCKETS, isValidDate, statement } from '@/lib/ar';
import { fyStart, one, parseAsOf, type SP } from '@/lib/asof';
import { balance, fmtDate, money } from '@/lib/format';
import { SELLER } from '@/lib/seller';
import PrintButton from '@/components/PrintButton';
import { btnLight, Card, Flash, input, PageTitle, Table, td, tdR, th, thR } from '@/components/ui';

export default async function StatementPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const data = await loadArData();
  const customerId = one(sp.customer);
  const from = isValidDate(one(sp.from)) ? one(sp.from) : fyStart(asof);
  const to = isValidDate(one(sp.to)) ? one(sp.to) : asof;
  const customer = data.customers.find((c) => String(c.id) === customerId);
  const error = from > to ? 'The From date must be on or before the To date.' : undefined;
  const s = customer && !error ? statement(data, customer.id, from, to) : null;
  const qs = new URLSearchParams({ customer: customerId, from, to });

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageTitle
          title="Statement of account"
          actions={s && (
            <>
              <PrintButton />
              <a className={btnLight} href={`/statement/export?${qs.toString()}`}>Export CSV</a>
            </>
          )}
        />
        <Flash error={error} />
        <Card>
          <form className="flex flex-wrap items-end gap-2 text-sm">
            <input type="hidden" name="asof" value={asof} />
            <select name="customer" defaultValue={customerId} className={`${input} w-64`} required>
              <option value="">Choose customer…</option>
              {data.customers.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name}</option>)}
            </select>
            <label className="flex items-center gap-1">From <input type="date" name="from" defaultValue={from} className={`${input} w-40`} /></label>
            <label className="flex items-center gap-1">To <input type="date" name="to" defaultValue={to} className={`${input} w-40`} /></label>
            <button className={btnLight}>Show statement</button>
          </form>
        </Card>
      </div>

      {s && customer && (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 print:border-0 print:p-0">
          <div className="mb-4 flex flex-wrap justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">{SELLER.name}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">{SELLER.address}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-base font-semibold">Statement of account</div>
              <div>{fmtDate(from)} to {fmtDate(to)}</div>
            </div>
          </div>
          <div className="mb-4 text-sm">
            <div className="font-medium">{customer.name} ({customer.code})</div>
            <div className="text-slate-600 dark:text-slate-400">{customer.city}, {customer.state}{customer.gstin ? ` · GSTIN ${customer.gstin}` : ''}</div>
          </div>
          <Table>
            <thead>
              <tr>
                <th className={th}>Date</th><th className={th}>Document</th><th className={th}>Particulars</th>
                <th className={thR}>Debit</th><th className={thR}>Credit</th><th className={thR}>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-medium">
                <td className={`${td} whitespace-nowrap`}>{fmtDate(from)}</td><td className={td} /><td className={td}>Opening balance</td>
                <td className={td} /><td className={td} /><td className={tdR}>{balance(s.opening)}</td>
              </tr>
              {s.lines.map((l, i) => (
                <tr key={i}>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(l.date)}</td>
                  <td className={`${td} whitespace-nowrap`}>{l.docNo}</td>
                  <td className={td}>{l.particulars}</td>
                  <td className={tdR}>{l.debit ? money(l.debit) : ''}</td>
                  <td className={tdR}>{l.credit ? money(l.credit) : ''}</td>
                  <td className={tdR}>{balance(l.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-300 dark:border-slate-600 font-semibold">
              <tr>
                <td className={`${td} whitespace-nowrap`}>{fmtDate(to)}</td><td className={td} /><td className={td}>Closing balance</td>
                <td className={tdR}>{money(s.lines.reduce((a, l) => a + l.debit, 0))}</td>
                <td className={tdR}>{money(s.lines.reduce((a, l) => a + l.credit, 0))}</td>
                <td className={tdR}>{balance(s.closing)}</td>
              </tr>
            </tfoot>
          </Table>
          <div className="mt-6 text-sm">
            <div className="mb-1 font-medium">Ageing of the closing balance as at {fmtDate(to)}</div>
            <Table>
              <thead><tr>{BUCKETS.map((b) => <th key={b} className={thR}>{b}</th>)}<th className={thR}>Unapplied credit</th></tr></thead>
              <tbody><tr>{BUCKETS.map((b) => <td key={b} className={tdR}>{money(s.buckets[b])}</td>)}<td className={tdR}>{money(s.unapplied)}</td></tr></tbody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
