import { NOTE_TYPES } from '@/lib/ar';
import { addNote } from '@/lib/actions/notes';
import { btn, Field, input } from './ui';

export default function NoteForm({
  customerId, invoiceId, asof, back, invoices,
}: { customerId: number; invoiceId?: number; asof: string; back: string; invoices?: { id: number; invoiceNo: string }[] }) {
  return (
    <form action={addNote} className="grid gap-3 text-sm md:grid-cols-2">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="back" value={back} />
      {invoiceId && <input type="hidden" name="invoiceId" value={invoiceId} />}
      <Field label="Date"><input type="date" name="noteDate" defaultValue={asof} required className={input} /></Field>
      <Field label="Type">
        <select name="noteType" className={input}>{NOTE_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </Field>
      {!invoiceId && invoices && (
        <Field label="Invoice (optional)">
          <select name="invoiceId" className={input}>
            <option value="">—</option>
            {invoices.map((i) => <option key={i.id} value={i.id}>{i.invoiceNo}</option>)}
          </select>
        </Field>
      )}
      <div className="md:col-span-2">
        <Field label="Note"><textarea name="body" required rows={2} className={input} /></Field>
      </div>
      <Field label="Follow-up date (optional)"><input type="date" name="followUpDate" className={input} /></Field>
      <div />
      <Field label="Promise to pay: date" hint="Date and amount together, or neither"><input type="date" name="promiseDate" className={input} /></Field>
      <Field label="Promise to pay: amount (₹)"><input name="promiseAmount" inputMode="decimal" className={input} /></Field>
      <div className="md:col-span-2"><button className={btn}>Add note</button></div>
    </form>
  );
}
