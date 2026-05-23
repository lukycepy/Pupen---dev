import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function clampInt(value: any, min: number, max: number, def: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export async function GET(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const supabase = getServerSupabase();

    const profRes = await supabase
      .from('profiles')
      .select('can_manage_admins, can_view_logs, can_edit_logs')
      .eq('id', user.id)
      .maybeSingle();
    if (profRes.error) throw profRes.error;

    const profile = profRes.data as any;
    const canView = !!(profile?.can_manage_admins || profile?.can_view_logs || profile?.can_edit_logs);
    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const source = String(url.searchParams.get('source') || 'admin');
    const q = String(url.searchParams.get('q') || '').trim();
    const from = clampInt(url.searchParams.get('from'), 0, 500_000, 0);
    const limit = clampInt(url.searchParams.get('limit'), 1, 500, 100);
    const to = from + limit - 1;

    if (source === 'admin') {
      let query = supabase.from('admin_logs').select('*').order('created_at', { ascending: false }).range(from, to);
      if (q) {
        const v = `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
        query = query.or(`admin_email.ilike.${v},admin_name.ilike.${v},action.ilike.${v},target_id.ilike.${v}`);
      }
      const res = await query;
      if (res.error) throw res.error;
      return NextResponse.json({ source, from, limit, items: res.data || [] });
    }

    if (source === 'error') {
      const level = String(url.searchParams.get('level') || '').trim();
      let query = supabase.from('error_logs').select('*').order('created_at', { ascending: false }).range(from, to);
      if (level) query = query.eq('level', level);
      if (q) {
        const v = `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
        query = query.or(`message.ilike.${v},stack.ilike.${v},url.ilike.${v},user_agent.ilike.${v}`);
      }
      const res = await query;
      if (res.error) throw res.error;
      return NextResponse.json({ source, from, limit, items: res.data || [] });
    }

    if (source === 'server') {
      const level = String(url.searchParams.get('level') || '').trim();
      const category = String(url.searchParams.get('category') || '').trim();
      const userId = String(url.searchParams.get('userId') || '').trim();

      let query = supabase.from('server_logs').select('*').order('created_at', { ascending: false }).range(from, to);
      if (level) query = query.eq('level', level);
      if (category) query = query.eq('category', category);
      if (userId) query = query.eq('user_id', userId);
      if (q) {
        const v = `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
        query = query.or(`message.ilike.${v},category.ilike.${v},request_id.ilike.${v},url.ilike.${v}`);
      }
      const res = await query;
      if (res.error) throw res.error;
      return NextResponse.json({ source, from, limit, items: res.data || [] });
    }

    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
