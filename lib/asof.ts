import { isValidDate } from './ar/dates';

/** Today in India as 'YYYY-MM-DD' (Vercel runs in UTC). */
export function todayIST(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

/** Reads ?asof=YYYY-MM-DD; falls back to today in Asia/Kolkata. */
export function parseAsOf(v: string | string[] | undefined, now?: Date): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s && isValidDate(s) ? s : todayIST(now);
}

export type SP = Promise<Record<string, string | string[] | undefined>>;

export function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/** Adds ?asof= to a path, keeping any existing query. */
export function withAsOf(path: string, asof: string): string {
  return path + (path.includes('?') ? '&' : '?') + 'asof=' + asof;
}
