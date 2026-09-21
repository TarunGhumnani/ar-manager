import { redirect } from 'next/navigation';
import type { z } from 'zod';

/** A safe in-app path from the form's hidden `back` field. */
export function backTo(fd: FormData, fallback = '/'): string {
  const b = String(fd.get('back') ?? '');
  return b.startsWith('/') && !b.startsWith('//') ? b : fallback;
}

export function withParam(path: string, key: string, value: string): string {
  const [p, q = ''] = path.split('?');
  const sp = new URLSearchParams(q);
  sp.delete('error');
  sp.delete('ok');
  sp.set(key, value);
  return `${p}?${sp.toString()}`;
}

export function fail(to: string, message: string): never {
  redirect(withParam(to, 'error', message));
}

export function done(to: string, message: string): never {
  redirect(withParam(to, 'ok', message));
}

export function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join(' ');
}

/** Turns database errors into plain language (section 4.6). */
export function friendly(message: string): string {
  if (message.includes('total_equals_taxable_plus_gst')) return 'The total does not equal the taxable value plus GST.';
  if (message.includes('duplicate key')) return 'That number or code is already in use. Please try again.';
  if (message.includes('permission denied')) return 'This record cannot be deleted. Cancel or deactivate it instead.';
  if (message.includes('violates foreign key')) return 'This record is linked to other records and cannot be removed.';
  if (message.includes('violates check constraint')) return `The database rejected a value: ${message}`;
  return message;
}

export const rupees = (p: number) => Number((p / 100).toFixed(2));
