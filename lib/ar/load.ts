import 'server-only';
import { db } from '@/lib/db';
import type { ArData } from './types';
import { mapRows } from './map';

/* eslint-disable @typescript-eslint/no-explicit-any */
export const TABLES = ['customers', 'invoices', 'credit_notes', 'receipts', 'allocations', 'notes'] as const;

export async function loadRawTables(): Promise<Record<string, any[]>> {
  const results = await Promise.all(TABLES.map((t) => db.from(t).select('*').order('id')));
  const out: Record<string, any[]> = {};
  results.forEach((r, i) => {
    if (r.error) throw new Error(`Loading ${TABLES[i]}: ${r.error.message}`);
    out[TABLES[i]] = r.data ?? [];
  });
  return out;
}

export async function loadArData(): Promise<ArData> {
  return mapRows(await loadRawTables());
}
