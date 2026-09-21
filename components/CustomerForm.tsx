import type { Customer } from '@/lib/ar';
import { plain } from '@/lib/format';
import { saveCustomer } from '@/lib/actions/customers';
import { btn, Field, input } from './ui';

export default function CustomerForm({ customer, asof, back }: { customer?: Customer; asof: string; back: string }) {
  const c = customer;
  return (
    <form action={saveCustomer} className="grid max-w-3xl gap-4 md:grid-cols-2">
      {c && <input type="hidden" name="id" value={c.id} />}
      <input type="hidden" name="asof" value={asof} />
      <input type="hidden" name="back" value={back} />
      <Field label="Code *"><input name="code" required defaultValue={c?.code} className={input} placeholder="C009" /></Field>
      <Field label="Name *"><input name="name" required defaultValue={c?.name} className={input} /></Field>
      <Field label="City *"><input name="city" required defaultValue={c?.city} className={input} /></Field>
      <Field label="State *" hint="Maharashtra → CGST + SGST; any other state → IGST">
        <input name="state" required defaultValue={c?.state} className={input} list="states" />
      </Field>
      <Field label="Contact person *"><input name="contact_person" required defaultValue={c?.contactPerson} className={input} /></Field>
      <Field label="Email *"><input name="email" type="email" required defaultValue={c?.email} className={input} /></Field>
      <Field label="Phone"><input name="phone" defaultValue={c?.phone ?? ''} className={input} /></Field>
      <Field label="GSTIN" hint="Optional, 15 characters">
        <input name="gstin" maxLength={15} defaultValue={c?.gstin ?? ''} className={input} />
      </Field>
      <Field label="Credit days *"><input name="credit_days" type="number" min={0} step={1} required defaultValue={c?.creditDays ?? 30} className={input} /></Field>
      <Field label="Credit limit (₹) *"><input name="credit_limit" required defaultValue={c ? plain(c.creditLimit) : ''} className={input} inputMode="decimal" /></Field>
      <Field label="TDS rate (%) *" hint="On taxable value; only pre-fills expected TDS">
        <input name="tds_rate_pct" type="number" min={0} max={100} step="0.01" required defaultValue={c?.tdsRatePct ?? 10} className={input} />
      </Field>
      <div className="md:col-span-2"><button className={btn}>{c ? 'Save changes' : 'Create customer'}</button></div>
      <datalist id="states">
        {['Maharashtra', 'Gujarat', 'Karnataka', 'Telangana', 'Tamil Nadu', 'Delhi', 'Goa', 'Madhya Pradesh', 'Rajasthan', 'Uttar Pradesh', 'West Bengal', 'Kerala', 'Andhra Pradesh', 'Haryana', 'Punjab']
          .map((s) => <option key={s} value={s} />)}
      </datalist>
    </form>
  );
}
