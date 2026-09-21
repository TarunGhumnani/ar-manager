'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { loadArData } from '@/lib/ar/load';
import { invoicePositions, isValidDate, nextNumber, receiptUnapplied, RECEIPT_MODES, type ArData } from '@/lib/ar';
import { fmtDate, money, parseRupees } from '@/lib/format';
import { backTo, done, fail, friendly, rupees, withParam } from './util';

/** R6 checks for one proposed allocation. Returns an error message or null. */
function checkAllocation(
  data: ArData, customerId: number, invoiceId: number, amount: number, allocDate: string, receiptDate: string,
): string | null {
  const inv = data.invoices.find((i) => i.id === invoiceId);
  if (!inv) return 'Invoice not found.';
  if (inv.customerId !== customerId) return `${inv.invoiceNo} belongs to a different customer.`;
  if (inv.isCancelled) return `${inv.invoiceNo} is cancelled; nothing can be allocated to it.`;
  if (allocDate < receiptDate) return `The allocation date cannot be before the receipt date (${fmtDate(receiptDate)}).`;
  if (allocDate < inv.invoiceDate) return `${inv.invoiceNo} is dated ${fmtDate(inv.invoiceDate)}, after the allocation date.`;
  const outstanding = invoicePositions(data, '9999-12-31').find((p) => p.invoice.id === invoiceId)!.outstanding;
  if (amount > outstanding) return `${inv.invoiceNo} has only ${money(outstanding)} outstanding; you tried to allocate ${money(amount)}.`;
  return null;
}

export async function recordPayment(fd: FormData) {
  const back = backTo(fd, '/receipts/new');
  const asof = String(fd.get('asof') ?? '');
  const customerId = Number(fd.get('customerId'));
  const date = String(fd.get('receiptDate') ?? '');
  const bank = parseRupees(String(fd.get('bank') ?? ''));
  const tds = parseRupees(String(fd.get('tds') ?? '0') || '0');
  const mode = String(fd.get('mode') ?? '');
  const reference = String(fd.get('reference') ?? '').trim();

  if (!customerId) fail(back, 'Choose a customer.');
  if (!isValidDate(date)) fail(back, 'Enter a valid receipt date.');
  if (bank === null || bank < 0) fail(back, 'Enter the amount received in the bank.');
  if (tds === null || tds < 0) fail(back, 'TDS must be zero or more.');
  if (bank + tds <= 0) fail(back, 'The receipt must be for more than zero.');
  if (!RECEIPT_MODES.includes(mode as never)) fail(back, 'Choose a payment mode.');
  if (!reference) fail(back, 'Enter the UTR, UPI or cheque reference.');

  let data = await loadArData();
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) fail(back, 'Customer not found.');

  const allocs: { invoiceId: number; amount: number }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith('alloc_')) continue;
    const amount = parseRupees(String(v) || '0');
    if (amount === null || amount < 0) fail(back, 'Allocation amounts must be numbers of zero or more.');
    if (amount > 0) allocs.push({ invoiceId: Number(k.slice(6)), amount });
  }
  const settlement = bank + tds;
  const totalAlloc = allocs.reduce((s, a) => s + a.amount, 0);
  if (totalAlloc > settlement) {
    fail(back, `You allocated ${money(totalAlloc)}, but the receipt settles only ${money(settlement)} (bank + TDS).`);
  }
  for (const a of allocs) {
    const err = checkAllocation(data, customerId, a.invoiceId, a.amount, date, date);
    if (err) fail(back, err);
  }

  let receiptId: number | null = null;
  let receiptNo = '';
  for (let attempt = 0; attempt < 2 && receiptId === null; attempt++) {
    receiptNo = nextNumber('receipt', data, date);
    const { data: ins, error } = await db
      .from('receipts')
      .insert({
        receipt_no: receiptNo, customer_id: customerId, receipt_date: date,
        bank_amount: rupees(bank), tds_amount: rupees(tds), mode, reference,
      })
      .select('id')
      .single();
    if (!error) receiptId = ins.id;
    else if (!error.message.includes('duplicate key') || attempt === 1) fail(back, friendly(error.message));
    else data = await loadArData();
  }

  if (allocs.length) {
    const { error } = await db.from('allocations').insert(
      allocs.map((a) => ({ receipt_id: receiptId, invoice_id: a.invoiceId, allocation_date: date, amount: rupees(a.amount) })),
    );
    if (error) {
      // No transactions across requests: undo the receipt so nothing half-saved remains (section 4.8).
      await db.from('receipts').delete().eq('id', receiptId!);
      fail(back, `The payment was not saved: ${friendly(error.message)}`);
    }
  }
  revalidatePath('/', 'layout');
  const left = settlement - totalAlloc;
  redirect(
    withParam(
      `/customers/${customerId}?asof=${asof}`,
      'ok',
      `Receipt ${receiptNo} saved: ${money(settlement)} (bank ${money(bank)} + TDS ${money(tds)}).` +
        (left > 0 ? ` ${money(left)} remains as unapplied credit.` : ''),
    ),
  );
}

export async function allocateCredit(fd: FormData) {
  const back = backTo(fd);
  const receiptId = Number(fd.get('receiptId'));
  const invoiceId = Number(fd.get('invoiceId'));
  const date = String(fd.get('allocationDate') ?? '');
  const amount = parseRupees(String(fd.get('amount') ?? ''));
  if (!invoiceId) fail(back, 'Choose an invoice.');
  if (!isValidDate(date)) fail(back, 'Enter a valid allocation date.');
  if (amount === null || amount <= 0) fail(back, 'Enter an amount above zero.');

  const data = await loadArData();
  const r = data.receipts.find((x) => x.id === receiptId);
  if (!r) fail(back, 'Receipt not found.');
  const unapplied = receiptUnapplied(data, receiptId);
  if (amount > unapplied) fail(back, `Receipt ${r.receiptNo} has only ${money(unapplied)} unapplied.`);
  const err = checkAllocation(data, r.customerId, invoiceId, amount, date, r.receiptDate);
  if (err) fail(back, err);

  const { error } = await db
    .from('allocations')
    .insert({ receipt_id: receiptId, invoice_id: invoiceId, allocation_date: date, amount: rupees(amount) });
  if (error) fail(back, friendly(error.message));
  revalidatePath('/', 'layout');
  done(back, `${money(amount)} allocated from ${r.receiptNo}.`);
}

export async function removeAllocation(fd: FormData) {
  const back = backTo(fd);
  const id = Number(fd.get('id'));
  const { error } = await db.from('allocations').delete().eq('id', id);
  if (error) fail(back, friendly(error.message));
  revalidatePath('/', 'layout');
  done(back, 'Allocation removed. The amount is back as unapplied credit.');
}

export async function deleteReceipt(fd: FormData) {
  const back = backTo(fd);
  const id = Number(fd.get('id'));
  const data = await loadArData();
  const r = data.receipts.find((x) => x.id === id);
  if (!r) fail(back, 'Receipt not found.');
  if (data.allocations.some((a) => a.receiptId === id)) {
    fail(back, `${r.receiptNo} still has allocations. Remove them first.`);
  }
  const { error } = await db.from('receipts').delete().eq('id', id);
  if (error) fail(back, friendly(error.message));
  revalidatePath('/', 'layout');
  done(back, `Receipt ${r.receiptNo} deleted.`);
}
