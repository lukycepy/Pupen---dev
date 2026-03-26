import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const safeId = String(id || '').trim();
    if (!safeId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase
      .from('lost_found_items')
      .select('*')
      .eq('id', safeId)
      .eq('is_public', true)
      .maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ ok: true, item: res.data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

