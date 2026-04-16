import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getServerSupabase();
  const res = await supabase
    .from('team_members')
    .select('id,name,role,email,phone,image_url,sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200);

  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });

  const out = NextResponse.json({ ok: true, items: res.data || [] });
  out.headers.set('Cache-Control', 'no-store');
  return out;
}
