// Saves the six tables to tests/fixtures/sample.json. Reset the workspace first.
// Run: node --env-file=.env.local scripts/snapshot.ts
import { writeFileSync } from 'node:fs';

const TABLES = ['customers', 'invoices', 'credit_notes', 'receipts', 'allocations', 'notes'];
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const ws = process.env.AR_WORKSPACE_ID;
if (!url || !key || !ws) throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY and AR_WORKSPACE_ID');

const out: Record<string, unknown[]> = {};
for (const t of TABLES) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*&order=id`, {
    headers: { apikey: key, 'x-workspace': ws },
  });
  if (!res.ok) throw new Error(`${t}: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Record<string, unknown>[];
  out[t] = rows.map(({ workspace_id: _w, created_at: _c, ...rest }) => rest);
}
writeFileSync('tests/fixtures/sample.json', JSON.stringify(out, null, 2) + '\n');
console.log(Object.entries(out).map(([t, r]) => `${t}: ${r.length}`).join(', '));
