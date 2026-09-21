'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { loadArData } from '@/lib/ar/load';
import { parseRupees } from '@/lib/format';
import { backTo, done, fail, friendly, rupees, withParam, zodMessage } from './util';

const CustomerSchema = z.object({
  code: z.string().trim().min(1, 'Code is required.').max(20, 'Code is too long.'),
  name: z.string().trim().min(1, 'Name is required.'),
  city: z.string().trim().min(1, 'City is required.'),
  state: z.string().trim().min(1, 'State is required.'),
  contact_person: z.string().trim().min(1, 'Contact person is required.'),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: z.string().trim().optional(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || /^[0-9A-Z]{15}$/.test(v), 'GSTIN must be exactly 15 letters or digits.'),
  credit_days: z.coerce.number().int('Credit days must be a whole number.').min(0, 'Credit days cannot be negative.'),
  credit_limit: z.number({ message: 'Enter a valid credit limit.' }).min(0, 'Credit limit cannot be negative.'),
  tds_rate_pct: z.coerce.number({ message: 'Enter a valid TDS rate.' }).min(0, 'TDS rate must be 0 to 100.').max(100, 'TDS rate must be 0 to 100.'),
});

export async function saveCustomer(fd: FormData) {
  const back = backTo(fd, '/customers');
  const asof = String(fd.get('asof') ?? '');
  const id = fd.get('id') ? Number(fd.get('id')) : null;
  const limit = parseRupees(String(fd.get('credit_limit') ?? ''));
  const parsed = CustomerSchema.safeParse({
    code: fd.get('code') ?? '', name: fd.get('name') ?? '', city: fd.get('city') ?? '', state: fd.get('state') ?? '',
    contact_person: fd.get('contact_person') ?? '', email: fd.get('email') ?? '', phone: fd.get('phone') ?? '',
    gstin: fd.get('gstin') ?? '', credit_days: fd.get('credit_days') || NaN,
    credit_limit: limit === null ? NaN : limit / 100, tds_rate_pct: fd.get('tds_rate_pct') ?? 0,
  });
  if (!parsed.success) fail(back, zodMessage(parsed.error));
  const v = parsed.data;

  const data = await loadArData();
  const clash = data.customers.find((c) => c.code.toLowerCase() === v.code.toLowerCase() && c.id !== id);
  if (clash) fail(back, `Customer code ${v.code} is already used by ${clash.name}.`);

  const row = {
    ...v, phone: v.phone || null, gstin: v.gstin || null, credit_limit: rupees(Math.round(v.credit_limit * 100)),
  };
  let savedId = id;
  if (id) {
    const { error } = await db.from('customers').update(row).eq('id', id);
    if (error) fail(back, friendly(error.message));
  } else {
    const { data: ins, error } = await db.from('customers').insert({ ...row, is_active: true }).select('id').single();
    if (error) fail(back, friendly(error.message));
    savedId = ins.id;
  }
  revalidatePath('/', 'layout');
  redirect(withParam(`/customers/${savedId}?asof=${asof}`, 'ok', id ? 'Customer updated.' : 'Customer created.'));
}

export async function setCustomerActive(fd: FormData) {
  const back = backTo(fd, '/customers');
  const id = Number(fd.get('id'));
  const active = fd.get('active') === 'true';
  const { error } = await db.from('customers').update({ is_active: active }).eq('id', id);
  if (error) fail(back, friendly(error.message));
  revalidatePath('/', 'layout');
  done(back, active ? 'Customer reactivated.' : 'Customer deactivated. They cannot be given new invoices.');
}
