import { parseAsOf, type SP } from '@/lib/asof';
import CustomerForm from '@/components/CustomerForm';
import { Card, Flash, PageTitle } from '@/components/ui';

export default async function NewCustomer({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const asof = parseAsOf(sp.asof);
  return (
    <div>
      <PageTitle title="Add customer" />
      <Flash error={sp.error as string} />
      <Card><CustomerForm asof={asof} back={`/customers/new?asof=${asof}`} /></Card>
    </div>
  );
}
