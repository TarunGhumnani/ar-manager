import 'server-only';
import { createClient } from '@supabase/supabase-js';

export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
  global: { headers: { 'x-workspace': process.env.AR_WORKSPACE_ID! } },
});
