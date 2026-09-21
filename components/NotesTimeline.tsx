import Link from 'next/link';
import type { ArData, Note } from '@/lib/ar';
import { promiseStatuses } from '@/lib/ar';
import { fmtDate, money } from '@/lib/format';
import { markFollowUpDone } from '@/lib/actions/notes';
import { btnLight, Label, StatusBadge } from './ui';

export default function NotesTimeline({ notes, data, asof, back }: { notes: Note[]; data: ArData; asof: string; back: string }) {
  const promises = new Map(promiseStatuses(data, asof).map((p) => [p.note.id, p]));
  const invNo = new Map(data.invoices.map((i) => [i.id, i.invoiceNo]));
  const visible = notes.filter((n) => n.noteDate <= asof).sort((a, b) => (a.noteDate < b.noteDate ? 1 : a.noteDate > b.noteDate ? -1 : b.id - a.id));
  if (!visible.length) return <p className="text-sm text-slate-500">No notes yet.</p>;
  return (
    <ol className="space-y-3 border-l-2 border-slate-200 pl-4 text-sm">
      {visible.map((n) => {
        const p = promises.get(n.id);
        const due = n.followUpDate && !n.followUpDone && n.followUpDate <= asof;
        return (
          <li key={n.id}>
            <div className="text-xs text-slate-500">
              {fmtDate(n.noteDate)} · {n.noteType}
              {n.invoiceId && <> · <Link className="text-blue-700 hover:underline" href={`/invoices/${n.invoiceId}?asof=${asof}`}>{invNo.get(n.invoiceId)}</Link></>}
            </div>
            <p className="text-slate-800">{n.body}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {n.followUpDate && (
                <span className={due ? 'font-medium text-red-700' : 'text-slate-600'}>
                  Follow up {fmtDate(n.followUpDate)}{n.followUpDone ? ' (done)' : due ? ' (due)' : ''}
                </span>
              )}
              {n.followUpDate && !n.followUpDone && (
                <form action={markFollowUpDone}>
                  <input type="hidden" name="id" value={n.id} />
                  <input type="hidden" name="back" value={back} />
                  <button className={`${btnLight} px-2 py-0.5 text-xs`}>Mark done</button>
                </form>
              )}
              {p && (
                <span>
                  Promise {money(p.promiseAmount)} by {fmtDate(p.promiseDate)} <StatusBadge status={p.status} />
                  <Label tone="slate">received {money(p.received)}</Label>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
