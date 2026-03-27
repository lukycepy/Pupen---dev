import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const queueId = String(id || '').trim();
    if (!queueId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase.from('email_send_queue').select('*').eq('id', queueId).maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, item: res.data });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const queueId = String(id || '').trim();
    if (!queueId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const patch: any = {};

    const allow = ['status', 'to_email', 'from_email', 'reply_to', 'subject', 'max_attempts', 'next_attempt_at'];
    for (const k of allow) {
      if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = (body as any)[k];
    }

    if ((body as any)?.unlock === true) {
      patch.locked_at = null;
      patch.locked_by = null;
    }
    patch.updated_at = new Date().toISOString();

    const supabase = getServerSupabase();
    const res = await supabase.from('email_send_queue').update(patch).eq('id', queueId);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
