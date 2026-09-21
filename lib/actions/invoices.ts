'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { loadArData } from '@/lib/ar/load';
import { creditNoteGst, dueDate, gstSplit, invoicePositions, isValidDate, nextNumber } from '@/lib/ar';
import { fmtDate, money, parseRupees } from '@/lib/format';
import { backTo, done, fail, friendly, rupees, withParam, zodMessage } from './util';

const InvoiceSchema = z.object({
  customerId: z.coerce.number().int().positive('Choose a customer.'),
  invoiceDate: z.string().refine(isValidDate, 'Enter a valid invoice date.'),
  description: z.string().trim().min(1, 'Description is required.'),
  taxable: z.number({ message: 'Enter a valid taxable value.' }).int().positive('Taxable value must be above zero.'),
  gstRate: z.coerce.number().min(0, 'GST rate cannot be negative.').max(28, 'GST rate looks wrong.'),
});

export async function createInvoice(fd: FormData) {
  const back = backTo(fd, '/invoices/new');
  const asof = String(fd.get('asof') ?? '');
  const parsed = InvoiceSchema.safeParse({
    customerId: fd.get('customerId'), invoiceDate: fd.get('invoiceDate'), description: fd.get('description'),
    taxable: parseRupees(String(fd.get('taxable') ?? '')) ?? NaN, gstRate: fd.get('gstRate') ?? 18,
  });
  if (!parsed.success) fail(back, zodMessage(parsed.error));
  const v = parsed.data;

  let data = await loadArData();
  const customer = data.customers.find((c) => c.id === v.customerId);
  if (!customer) fail(back, 'Customer not found.');
  if (!customer.isActive) fail(back, `${customer.name} is inactive and cannot be given new invoices.`);

  const gst = gstSplit(customer.state, v.taxable, v.gstRate);
  const total = v.taxable + gst.cgst + gst.sgst + gst.igst;
  const row = {
    customer_id: customer.id, invoice_date: v.invoiceDate, due_date: dueDate(v.invoiceDate, customer.creditDays),
    description: v.description, taxable_value: rupees(v.taxable), gst_rate_pct: v.gstRate,
    cgst: rupees(gst.cgst), sgst: rupees(gst.sgst), igst: rupees(gst.igst), total: rupees(total),
    is_cancelled: false, is_disputed: false,
  };

  // Retry once if another tab took the number at the same moment (section 4.8).
  for (let attempt = 0; attempt < 2; attempt++) {
    const invoice_no = nextNumber('invoice', data, v.invoiceDate);
    const { data: ins, error } = await db.from('invoices').insert({ ...row, invoice_no }).select('id').single();
    if (!error) {
      revalidatePath('/', 'layout');
      redirect(withParam(`/invoices/${ins.id}?asof=${asof}`, 'ok', `Invoice ${invoice_no} created.`));
    }
    if (!error.message.includes('duplicate key') || attempt === 1) fail(back, friendly(error.message));
    data = await loadArData();
  }
}

export async function setDisputed(fd: FormData) {
  const back = backTo(fd);
  const id = Number(fd.get('id'));
  const disputed = fd.get('disputed') === 'true';
  const { error } = await db.from('invoices').update({ is_disputed: disputed }).eq('id', id);
  if (error) fail(back, friendly(error.message));
  revalidatePath('/', 'layout');
  done(back, disputed ? 'Invoice marked as disputed.' : 'Dispute cleared.');
}

export async function cancelInvoice(fd: FormData) {
  const back = backTo(fd);
  const id = Number(fd.get('id'));
  const data = await loadArData();
  const inv = data.invoices.find((i) => i.id === id);
  if (!inv) fail(back, 'Invoice not found.');
  if (inv.isCancelled) fail(back, 'This invoice is already cancelled.');
  const allocs = data.allocations.filter((a) => a.invoiceId === id).length;
  const cns = data.creditNotes.filter((c) => c.invoiceId === id).length;
  if (allocs || cns) {
    fail(back, `${inv.invoiceNo} cannot be cancelled: it has ${allocs} payment allocation(s) and ${cns} credit note(s). Remove the allocations first, or raise a credit note instead.`);
  }
  const { error } = await db.from('invoices').update({ is_cancelled: true }).eq('id', id);
  if (error) fail(back, friendly(error.message));
  revalidatePath('/', 'layout');
  done(back, `${inv.invoiceNo} cancelled. Its number will not be reused.`);
}

export async function createCreditNote(fd: FormData) {
  const back = backTo(fd);
  const invoiceId = Number(fd.get('invoiceId'));
  const date = String(fd.get('creditNoteDate') ?? '');
  const reason = String(fd.get('reason') ?? '').trim();
  const taxable = parseRupees(String(fd.get('taxable') ?? ''));

  if (!isValidDate(date)) fail(back, 'Enter a valid credit note date.');
  if (taxable === null || taxable <= 0) fail(back, 'Enter a taxable value above zero.');
  if (!reason) fail(back, 'Give a reason for the credit note.');

  let data = await loadArData();
  const inv = data.invoices.find((i) => i.id === invoiceId);
  if (!inv) fail(back, 'Invoice not found.');
  if (inv.isCancelled) fail(back, 'A cancelled invoice cannot be credited.');
  if (date < inv.invoiceDate) fail(back, `The credit note cannot be dated before the invoice (${fmtDate(inv.invoiceDate)}).`);

  const gst = creditNoteGst(inv, taxable);
  const total = taxable + gst.cgst + gst.sgst + gst.igst;
  const outstanding = invoicePositions(data, '9999-12-31').find((p) => p.invoice.id === invoiceId)!.outstanding;
  if (total > outstanding) {
    fail(back, `A credit note of ${money(total)} (incl. GST) is more than the ${money(outstanding)} outstanding on ${inv.invoiceNo}.`);
  }

  const row = {
    invoice_id: invoiceId, credit_note_date: date, taxable_value: rupees(taxable),
    cgst: rupees(gst.cgst), sgst: rupees(gst.sgst), igst: rupees(gst.igst), total: rupees(total), reason,
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const credit_note_no = nextNumber('creditNote', data, date);
    const { error } = await db.from('credit_notes').insert({ ...row, credit_note_no });
    if (!error) {
      revalidatePath('/', 'layout');
      done(back, `Credit note ${credit_note_no} for ${money(total)} raised.`);
    }
    if (!error.message.includes('duplicate key') || attempt === 1) fail(back, friendly(error.message));
    data = await loadArData();
  }
}
