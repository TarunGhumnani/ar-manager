import { notFound } from 'next/navigation';
import { loadArData } from '@/lib/ar/load';
import { parseAsOf, type SP } from '@/lib/asof';
import CustomerForm from '@/components/CustomerForm';
import { Card, Flash, PageTitle } from '@/components/ui';

export default async function EditCustomer({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  const data = await loadArData();
  const customer = data.customers.find((c) => c.id === Number(id));
  if (!customer) notFound();
  return (
    <div>
      <PageTitle title={`Edit ${customer.code} · ${customer.name}`} sub="Changing credit days does not change existing invoices' due dates." />
      <Flash error={sp.error as string} />
      <Card><CustomerForm customer={customer} asof={asof} back={`/customers/${id}/edit?asof=${asof}`} /></Card>
    </div>
  );
}
