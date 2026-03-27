import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const query = String(searchParams.get('query') || '').trim();
    const limitRaw = Number(searchParams.get('limit') || 10);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 10;

    if (query.length < 2) return NextResponse.json({ ok: true, users: [] });

    const q = query.replaceAll('%', '').slice(0, 64);
    const parts = q.split(/\s+/).filter(Boolean);
    const supabase = getServerSupabase();
    
    let queryBuilder = supabase
      .from('profiles')
      .select('id,email,first_name,last_name,is_member,is_admin')
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .limit(limit);

    if (parts.length === 1) {
      const pattern = `%${parts[0]}%`;
      queryBuilder = queryBuilder.or(`email.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern}`);
    } else if (parts.length >= 2) {
      const p1 = `%${parts[0]}%`;
      const p2 = `%${parts[1]}%`;
      queryBuilder = queryBuilder.or(
        `and(first_name.ilike.${p1},last_name.ilike.${p2}),and(first_name.ilike.${p2},last_name.ilike.${p1}),email.ilike.%${q}%`
      );
    }

    const res = await queryBuilder;

    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, users: res.data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

