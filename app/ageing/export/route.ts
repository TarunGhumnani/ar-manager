import { loadArData } from '@/lib/ar/load';
import { BUCKETS, customerPositions } from '@/lib/ar';
import { parseAsOf } from '@/lib/asof';
import { plain, toCsv } from '@/lib/format';

export async function GET(req: Request) {
  const asof = parseAsOf(new URL(req.url).searchParams.get('asof') ?? undefined);
  const data = await loadArData();
  const rows = customerPositions(data, asof).filter((c) => c.outstanding !== 0 || c.unapplied !== 0);
  const csv = toCsv([
    ['Customer code', 'Customer', ...BUCKETS, 'Outstanding', 'Unapplied credit', 'Net balance'],
    ...rows.map((c) => [
      c.customer.code, c.customer.name, ...BUCKETS.map((b) => plain(c.buckets[b])),
      plain(c.outstanding), plain(c.unapplied), plain(c.netBalance),
    ]),
  ]);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="Ageing_${asof}.csv"`,
    },
  });
}
