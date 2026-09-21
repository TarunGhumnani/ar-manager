'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { isValidDate, NOTE_TYPES } from '@/lib/ar';
import { parseRupees } from '@/lib/format';
import { backTo, done, fail, friendly, rupees } from './util';

export async function addNote(fd: FormData) {
  const back = backTo(fd);
  const customerId = Number(fd.get('customerId'));
  const invoiceId = fd.get('invoiceId') ? Number(fd.get('invoiceId')) : null;
  const noteDate = String(fd.get('noteDate') ?? '');
  const noteType = String(fd.get('noteType') ?? '');
  const body = String(fd.get('body') ?? '').trim();
  const followUp = String(fd.get('followUpDate') ?? '');
  const promiseDate = String(fd.get('promiseDate') ?? '');
  const promiseAmtRaw = String(fd.get('promiseAmount') ?? '').trim();

  if (!customerId) fail(back, 'Choose a customer.');
  if (!isValidDate(noteDate)) fail(back, 'Enter a valid note date.');
  if (!NOTE_TYPES.includes(noteType as never)) fail(back, 'Choose a note type.');
  if (!body) fail(back, 'Write the note.');
  if (followUp && !isValidDate(followUp)) fail(back, 'Enter a valid follow-up date.');
  if (followUp && followUp < noteDate) fail(back, 'The follow-up date cannot be before the note date.');
  if (!!promiseDate !== !!promiseAmtRaw) fail(back, 'A promise to pay needs both a date and an amount, or neither.');
  const promiseAmount = promiseAmtRaw ? parseRupees(promiseAmtRaw) : null;
  if (promiseDate && !isValidDate(promiseDate)) fail(back, 'Enter a valid promise date.');
  if (promiseAmtRaw && (promiseAmount === null || promiseAmount <= 0)) fail(back, 'The promised amount must be above zero.');

  const { error } = await db.from('notes').insert({
    customer_id: customerId, invoice_id: invoiceId, note_date: noteDate, note_type: noteType, body,
    follow_up_date: followUp || null, follow_up_done: false,
    promise_date: promiseDate || null, promise_amount: promiseAmount === null ? null : rupees(promiseAmount),
  });
  if (error) fail(back, friendly(error.message));
  revalidatePath('/', 'layout');
  done(back, 'Note added.');
}

export async function markFollowUpDone(fd: FormData) {
  const back = backTo(fd);
  const id = Number(fd.get('id'));
  const { error } = await db.from('notes').update({ follow_up_done: true }).eq('id', id);
  if (error) fail(back, friendly(error.message));
  revalidatePath('/', 'layout');
  done(back, 'Follow-up marked as done.');
}
