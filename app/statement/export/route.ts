import { loadArData } from '@/lib/ar/load';
import { BUCKETS, isValidDate, statement } from '@/lib/ar';
import { plain, toCsv } from '@/lib/format';

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const from = p.get('from') ?? '';
  const to = p.get('to') ?? '';
  const data = await loadArData();
  const customer = data.customers.find((c) => String(c.id) === p.get('customer'));
  if (!customer || !isValidDate(from) || !isValidDate(to) || from > to) {
    return new Response('Choose a customer and a valid period.', { status: 400 });
  }
  const s = statement(data, customer.id, from, to);
  const csv = toCsv([
    ['Statement of account', customer.name, customer.code],
    ['Period', from, to],
    [],
    ['Date', 'Document', 'Particulars', 'Debit', 'Credit', 'Balance'],
    [from, '', 'Opening balance', '', '', plain(s.opening)],
    ...s.lines.map((l) => [l.date, l.docNo, l.particulars, l.debit ? plain(l.debit) : '', l.credit ? plain(l.credit) : '', plain(l.balance)]),
    [to, '', 'Closing balance', '', '', plain(s.closing)],
    [],
    [...BUCKETS, 'Unapplied credit'],
    [...BUCKETS.map((b) => plain(s.buckets[b])), plain(s.unapplied)],
  ]);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Statement_${customer.code}_${from}_to_${to}.csv"`,
    },
  });
}
