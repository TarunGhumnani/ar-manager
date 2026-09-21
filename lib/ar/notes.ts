import type { ArData, Note, Paise } from './types';

export type PromiseStatus = 'Kept' | 'Broken' | 'Pending';

export interface PromiseRow {
  note: Note;
  promiseDate: string;
  promiseAmount: Paise;
  received: Paise;
  status: PromiseStatus;
}

/** R16: every promise to pay noted on or before asOf, with its status. */
export function promiseStatuses(data: ArData, asOf: string): PromiseRow[] {
  return data.notes
    .filter((n) => n.noteDate <= asOf && n.promiseDate !== null && n.promiseAmount !== null)
    .map((n) => {
      const promiseDate = n.promiseDate!;
      const promiseAmount = n.promiseAmount!;
      const end = promiseDate < asOf ? promiseDate : asOf;
      let received = 0;
      for (const r of data.receipts) {
        if (r.customerId === n.customerId && r.receiptDate >= n.noteDate && r.receiptDate <= end) {
          received += r.bankAmount + r.tdsAmount;
        }
      }
      const status: PromiseStatus = received >= promiseAmount ? 'Kept' : promiseDate < asOf ? 'Broken' : 'Pending';
      return { note: n, promiseDate, promiseAmount, received, status };
    });
}

/** R16: open follow-ups due on or before asOf (for notes that exist as at asOf). */
export function followUpsDue(data: ArData, asOf: string): Note[] {
  return data.notes
    .filter((n) => n.noteDate <= asOf && n.followUpDate !== null && n.followUpDate <= asOf && !n.followUpDone)
    .sort((a, b) => (a.followUpDate! < b.followUpDate! ? -1 : 1));
}
