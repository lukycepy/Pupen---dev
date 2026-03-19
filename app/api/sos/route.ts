import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = getServerSupabase();
    const res = await supabase
      .from('sos_contacts')
      .select('*')
      .eq('is_public', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(200);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, items: res.data || [] });
  } catch {
    return NextResponse.json({ ok: true, items: [] });
  }
}

