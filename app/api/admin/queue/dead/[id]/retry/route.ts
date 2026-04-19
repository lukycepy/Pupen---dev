import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const deadId = String(id || '').trim();
    if (!deadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const row = await supabase.from('email_send_dead_letters').select('*').eq('id', deadId).single();
    if (row.error) throw row.error;
    const d: any = row.data;

    await supabase
      .from('email_send_queue')
      .insert([
        {
          status: 'queued',
          to_email: String(d.to_email || ''),
          from_email: String(d.from_email || ''),
          reply_to: d.reply_to || null,
          subject: String(d.subject || ''),
          html: String(d.html || ''),
          text: d.text ? String(d.text) : null,
          headers: d.headers && typeof d.headers === 'object' ? d.headers : {},
          meta: d.meta || {},
          attempt_count: 0,
          max_attempts: Number(d.max_attempts || 5),
          last_error: null,
          next_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .throwOnError();

    await supabase.from('email_send_dead_letters').delete().eq('id', deadId).throwOnError();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
