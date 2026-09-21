import Link from 'next/link';
import { loadArData } from '@/lib/ar/load';
import { customerPositions } from '@/lib/ar';
import { one, parseAsOf, type SP } from '@/lib/asof';
import { balance, money } from '@/lib/format';
import { sortRows } from '@/lib/sort';
import { btn, btnLight, Card, Flash, input, Label, PageTitle, SortTh, Table, td, tdR } from '@/components/ui';

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const q = one(sp.q).trim().toLowerCase();
  const status = one(sp.status) || 'all';
  const sort = one(sp.sort) || 'code';
  const dir = one(sp.dir) || 'asc';

  const data = await loadArData();
  let rows = customerPositions(data, asof).filter((p) => {
    const c = p.customer;
    if (status === 'active' && !c.isActive) return false;
    if (status === 'inactive' && c.isActive) return false;
    if (!q) return true;
    return [c.code, c.name, c.contactPerson, c.email].some((s) => s.toLowerCase().includes(q));
  });
  rows = sortRows(rows, {
    code: (p) => p.customer.code, name: (p) => p.customer.name, city: (p) => `${p.customer.city} ${p.customer.state}`,
    contact: (p) => p.customer.contactPerson, days: (p) => p.customer.creditDays, limit: (p) => p.customer.creditLimit,
    balance: (p) => p.netBalance, overdue: (p) => p.overdue, used: (p) => p.limitUsedPct, status: (p) => (p.customer.isActive ? 0 : 1),
  }, sort, dir);

  const base = new URLSearchParams({ asof, q: one(sp.q), status });
  const s = { sort, dir, base };

  return (
    <div>
      <PageTitle
        title="Customer Master"
        sub={`${rows.length} customer(s) · balances as at ${asof.split('-').reverse().join('-')}`}
        actions={<Link className={btn} href={`/customers/new?asof=${asof}`}>Add customer</Link>}
      />
      <Flash error={sp.error as string} ok={sp.ok as string} />
      <Card>
        <form className="mb-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="asof" value={asof} />
          <input name="q" defaultValue={one(sp.q)} placeholder="Search code, name, contact or email" className={`${input} max-w-xs`} />
          <select name="status" defaultValue={status} className={`${input} w-36`}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className={btnLight}>Filter</button>
        </form>
        <Table>
          <thead>
            <tr>
              <SortTh k="code" label="Code" {...s} />
              <SortTh k="name" label="Name" {...s} />
              <SortTh k="city" label="City, state" {...s} />
              <SortTh k="contact" label="Contact" {...s} />
              <SortTh k="days" label="Credit days" right {...s} />
              <SortTh k="limit" label="Credit limit" right {...s} />
              <SortTh k="balance" label="Balance" right {...s} />
              <SortTh k="overdue" label="Overdue" right {...s} />
              <SortTh k="used" label="Limit used" right {...s} />
              <SortTh k="status" label="Status" {...s} />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.customer.id} className={p.customer.isActive ? '' : 'text-slate-400'}>
                <td className={td}>{p.customer.code}</td>
                <td className={td}>
                  <Link className="text-blue-700 hover:underline" href={`/customers/${p.customer.id}?asof=${asof}`}>{p.customer.name}</Link>
                </td>
                <td className={td}>{p.customer.city}, {p.customer.state}</td>
                <td className={td}>{p.customer.contactPerson}<span className="block text-xs text-slate-500">{p.customer.email}</span></td>
                <td className={tdR}>{p.customer.creditDays}</td>
                <td className={tdR}>{money(p.customer.creditLimit)}</td>
                <td className={tdR}>{balance(p.netBalance)}</td>
                <td className={`${tdR} ${p.overdue > 0 ? 'text-red-700' : ''}`}>{money(p.overdue)}</td>
                <td className={`${tdR} ${p.overLimit ? 'font-semibold text-red-700' : ''}`}>
                  {p.limitUsedPct === null ? '—' : `${p.limitUsedPct.toFixed(1)}%`}
                </td>
                <td className={td}>
                  {p.customer.isActive ? 'Active' : 'Inactive'}
                  {p.overLimit && <Label>over limit</Label>}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td className={td} colSpan={10}>No customers match.</td></tr>}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
