import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins && !profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const status = String(url.searchParams.get('status') || 'pending');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 500);

    const supabase = getServerSupabase();
    let q = supabase
      .from('post_comments')
      .select('id, created_at, post_id, user_id, author_email, author_name, body, status, moderated_at, moderated_by')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status && status !== 'all') q = q.eq('status', status);
    const res = await q;
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, comments: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins && !profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const commentId = String(body?.commentId || body?.id || '').trim();
    const action = String(body?.action || '').trim();
    if (!commentId || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!['approve', 'reject', 'delete'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    const supabase = getServerSupabase();
    if (action === 'delete') {
      const del = await supabase.from('post_comments').delete().eq('id', commentId);
      if (del.error) throw del.error;
      return NextResponse.json({ ok: true });
    }

    const nextStatus = action === 'approve' ? 'approved' : 'rejected';
    const upd = await supabase
      .from('post_comments')
      .update({ status: nextStatus, moderated_at: new Date().toISOString(), moderated_by: user.email || 'admin' })
      .eq('id', commentId);
    if (upd.error) throw upd.error;
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

