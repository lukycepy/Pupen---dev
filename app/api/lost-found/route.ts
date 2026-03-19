import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 20)));
  const status = url.searchParams.get('status');
  const category = url.searchParams.get('category');

  try {
    const supabase = getServerSupabase();
    let q = supabase
      .from('lost_found_items')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) q = q.eq('status', status);
    if (category) q = q.eq('category', category);

    const res = await q;
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, items: res.data || [] });
  } catch {
    return NextResponse.json({ ok: true, items: [] });
  }
}

