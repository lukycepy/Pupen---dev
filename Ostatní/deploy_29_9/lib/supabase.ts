import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  if (!cached) cached = createClient(url, key);
  return cached;
}

export const supabase = new Proxy(
  {},
  {
    get(_target, prop) {
      return (getSupabase() as any)[prop as any];
    },
  }
) as unknown as SupabaseClient;
