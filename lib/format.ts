import type { Paise } from './ar/types';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ₹1,23,456.00 */
export function money(p: Paise): string {
  return inr.format(p / 100);
}

/** ₹88,800.00 Dr / ₹1,00,000.00 Cr / ₹0.00 */
export function balance(p: Paise): string {
  if (p === 0) return money(0);
  return `${money(Math.abs(p))} ${p > 0 ? 'Dr' : 'Cr'}`;
}

/** '2026-08-31' → '31-Aug-2026' */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}-${MONTHS[Number(m) - 1]}-${y}`;
}

/** Paise → '70800.00' for CSV and for sending to the database. */
export function plain(p: Paise): string {
  return (p / 100).toFixed(2);
}

/** Rupee text from a form ('1,23,456.5') → paise, or null if not a number. */
export function parseRupees(s: string | null | undefined): Paise | null {
  if (s === null || s === undefined) return null;
  const t = String(s).replace(/[₹,\s]/g, '');
  if (t === '' || !/^-?\d+(\.\d{0,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

export function csvField(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number)[][]): string {
  return '﻿' + rows.map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}
