import Link from 'next/link';
import { loadArData } from '@/lib/ar/load';
import { BUCKETS, customerPositions, dso, followUpsDue, invoicePositions, promiseStatuses, receiptPositions } from '@/lib/ar';
import { parseAsOf, type SP } from '@/lib/asof';
import { balance, fmtDate, money } from '@/lib/format';
import { markFollowUpDone } from '@/lib/actions/notes';
import { btnLight, Card, Flash, Label, PageTitle, Stat, StatusBadge, Table, td, tdR, th, thR } from '@/components/ui';

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const data = await loadArData();
  const custName = new Map(data.customers.map((c) => [c.id, c]));

  const invs = invoicePositions(data, asof);
  const custs = customerPositions(data, asof);
  const outstanding = custs.reduce((s, c) => s + c.outstanding, 0);
  const unapplied = custs.reduce((s, c) => s + c.unapplied, 0);
  const overdue = custs.reduce((s, c) => s + c.overdue, 0);
  const overdueInvs = invs.filter((p) => p.status === 'Overdue').sort((a, b) => b.daysPastDue - a.daysPastDue);
  const d = dso(data, asof);

  const ageingRows = custs.filter((c) => c.outstanding !== 0 || c.unapplied !== 0);
  const totals = Object.fromEntries(BUCKETS.map((b) => [b, ageingRows.reduce((s, c) => s + c.buckets[b], 0)]));

  const overLimit = custs.filter((c) => c.overLimit);
  const broken = promiseStatuses(data, asof).filter((p) => p.status === 'Broken');
  const followUps = followUpsDue(data, asof);
  const waiting = receiptPositions(data, asof).filter((r) => r.unapplied > 0);
  const q = (path: string) => `${path}${path.includes('?') ? '&' : '?'}asof=${asof}`;

  return (
    <div className="space-y-6">
      <PageTitle
        title="Overdue at a glance"
        sub={`Position as at ${fmtDate(asof)}`}
        actions={<a className={btnLight} href={q('/ageing/export')}>Export ageing CSV</a>}
      />
      <Flash error={sp.error as string} ok={sp.ok as string} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Outstanding on invoices" value={money(outstanding)} />
        <Stat label="Unapplied credit" value={money(unapplied)} />
        <Stat label="Net receivable" value={balance(outstanding - unapplied)} />
        <Stat
          label="Overdue"
          tone="red"
          value={
            <>
              {money(overdue)}{' '}
              <span className="text-sm font-normal">({outstanding ? ((overdue / outstanding) * 100).toFixed(1) : '0.0'}%)</span>
            </>
          }
        />
        <Stat label="DSO (90 days)" value={d === null ? '—' : `${d} days`} />
        <Stat label="Overdue invoices" tone="red" value={overdueInvs.length} />
      </div>

      <Card title="Ageing by customer">
        <Table>
          <thead>
            <tr>
              <th className={th}>Customer</th>
              {BUCKETS.map((b) => <th key={b} className={thR}>{b}</th>)}
              <th className={thR}>Outstanding</th>
              <th className={thR}>Unapplied</th>
              <th className={thR}>Net balance</th>
            </tr>
          </thead>
          <tbody>
            {ageingRows.map((c) => (
              <tr key={c.customer.id} className={c.overLimit ? 'bg-red-50/50 dark:bg-red-950/30' : ''}>
                <td className={td}>
                  <Link className="text-blue-700 dark:text-blue-400 hover:underline" href={q(`/invoices?customer=${c.customer.id}&status=open`)}>
                    {c.customer.code} · {c.customer.name}
                  </Link>
                </td>
                {BUCKETS.map((b) => (
                  <td key={b} className={`${tdR} ${b !== 'Not due' && c.buckets[b] ? 'text-red-700 dark:text-red-400' : ''}`}>
                    {c.buckets[b] ? money(c.buckets[b]) : '–'}
                  </td>
                ))}
                <td className={tdR}>{money(c.outstanding)}</td>
                <td className={tdR}>{c.unapplied ? money(c.unapplied) : '–'}</td>
                <td className={`${tdR} font-medium`}>{balance(c.netBalance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-300 dark:border-slate-600 font-semibold">
            <tr>
              <td className={td}>Total</td>
              {BUCKETS.map((b) => <td key={b} className={tdR}>{money(totals[b])}</td>)}
              <td className={tdR}>{money(outstanding)}</td>
              <td className={tdR}>{money(unapplied)}</td>
              <td className={tdR}>{balance(outstanding - unapplied)}</td>
            </tr>
          </tfoot>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={`Overdue invoices (${overdueInvs.length})`} className="lg:col-span-2">
          <Table>
            <thead>
              <tr>
                <th className={th}>Invoice</th>
                <th className={th}>Customer</th>
                <th className={th}>Due</th>
                <th className={thR}>Days late</th>
                <th className={thR}>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {overdueInvs.map((p) => (
                <tr key={p.invoice.id} className="bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-200">
                  <td className={td}>
                    <Link className="hover:underline" href={q(`/invoices/${p.invoice.id}`)}>{p.invoice.invoiceNo}</Link>
                    {p.isPartPaid && <Label tone="slate">part-paid</Label>}
                    {p.invoice.isDisputed && <Label>disputed</Label>}
                  </td>
                  <td className={td}>{custName.get(p.invoice.customerId)?.name}</td>
                  <td className={td}>{fmtDate(p.invoice.dueDate)}</td>
                  <td className={tdR}>{p.daysPastDue}</td>
                  <td className={tdR}>{money(p.outstanding)}</td>
                </tr>
              ))}
              {!overdueInvs.length && <tr><td className={td} colSpan={5}>Nothing is overdue.</td></tr>}
            </tbody>
          </Table>
        </Card>

        <Card title="Needs attention">
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium text-slate-800 dark:text-slate-200">Over credit limit</h3>
              {overLimit.length ? overLimit.map((c) => (
                <p key={c.customer.id}>
                  <Link className="text-blue-700 dark:text-blue-400 hover:underline" href={q(`/customers/${c.customer.id}`)}>{c.customer.name}</Link>:{' '}
                  {balance(c.netBalance)} vs limit {money(c.customer.creditLimit)}
                </p>
              )) : <p className="text-slate-500 dark:text-slate-400">None.</p>}
            </div>
            <div>
              <h3 className="font-medium text-slate-800 dark:text-slate-200">Broken promises</h3>
              {broken.length ? broken.map((p) => (
                <p key={p.note.id}>
                  <Link className="text-blue-700 dark:text-blue-400 hover:underline" href={q(`/customers/${p.note.customerId}`)}>
                    {custName.get(p.note.customerId)?.name}
                  </Link>: {money(p.promiseAmount)} by {fmtDate(p.promiseDate)}, received {money(p.received)}{' '}
                  <StatusBadge status="Broken" />
                </p>
              )) : <p className="text-slate-500 dark:text-slate-400">None.</p>}
            </div>
            <div>
              <h3 className="font-medium text-slate-800 dark:text-slate-200">Follow-ups due</h3>
              {followUps.length ? followUps.map((n) => (
                <div key={n.id} className="mb-2 flex items-start justify-between gap-2">
                  <p>
                    <span className="font-medium">{fmtDate(n.followUpDate)}</span> ·{' '}
                    <Link className="text-blue-700 dark:text-blue-400 hover:underline" href={q(`/customers/${n.customerId}`)}>
                      {custName.get(n.customerId)?.name}
                    </Link>
                    <span className="block text-slate-600 dark:text-slate-400">{n.body}</span>
                  </p>
                  <form action={markFollowUpDone}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="back" value={q('/')} />
                    <button className={`${btnLight} whitespace-nowrap text-xs`}>Done</button>
                  </form>
                </div>
              )) : <p className="text-slate-500 dark:text-slate-400">None.</p>}
            </div>
            <div>
              <h3 className="font-medium text-slate-800 dark:text-slate-200">Unapplied credit to allocate</h3>
              {waiting.length ? waiting.map((r) => (
                <p key={r.receipt.id}>
                  <Link className="text-blue-700 dark:text-blue-400 hover:underline" href={q(`/customers/${r.receipt.customerId}`)}>
                    {custName.get(r.receipt.customerId)?.name}
                  </Link>: {money(r.unapplied)} from {r.receipt.receiptNo}
                </p>
              )) : <p className="text-slate-500 dark:text-slate-400">None.</p>}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
