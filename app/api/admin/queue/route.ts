import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const view = url.searchParams.get('view') === 'dead' ? 'dead' : 'queue';
    const status = String(url.searchParams.get('status') || '').trim();
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const limit = clamp(Number(url.searchParams.get('limit') || 50) || 50, 1, 200);
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0) || 0);

    const supabase = getServerSupabase();

    if (view === 'dead') {
      let query: any = supabase
        .from('email_send_dead_letters')
        .select('*')
        .order('failed_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (q) {
        query = query.or(
          `to_email.ilike.%${q}%,from_email.ilike.%${q}%,subject.ilike.%${q}%,final_error.ilike.%${q}%`,
        );
      }

      const res = await query;
      if (res.error) throw res.error;
      return NextResponse.json({ ok: true, view, items: res.data || [] });
    }

    let query: any = supabase
      .from('email_send_queue')
      .select('*')
      .order('next_attempt_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (q) {
      query = query.or(`to_email.ilike.%${q}%,from_email.ilike.%${q}%,subject.ilike.%${q}%,last_error.ilike.%${q}%`);
    }

    const res = await query;
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, view, items: res.data || [] });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

