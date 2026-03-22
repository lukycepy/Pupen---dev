import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

const ALLOWED_EVENTS = new Set([
  'MFA_ENROLL_START',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'GOOGLE_LINK_START',
  'GOOGLE_LINK_UNSUPPORTED',
  'GOOGLE_LINK_ERROR',
]);

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));

    const event = String(body?.event || '');
    if (!ALLOWED_EVENTS.has(event)) return NextResponse.json({ error: 'Invalid event' }, { status: 400 });

    const detailsRaw = body?.details;
    const details = detailsRaw && typeof detailsRaw === 'object' ? detailsRaw : {};
    const detailsSize = JSON.stringify(details).length;
    if (detailsSize > 4000) return NextResponse.json({ error: 'Details too large' }, { status: 400 });

    const supabase = getServerSupabase();
    const ins = await supabase
      .from('user_security_logs')
      .insert([
        {
          user_id: user.id,
          user_email: user.email || null,
          event,
          details,
        },
      ])
      .select('id')
      .single();
    if (ins.error) throw ins.error;

    return NextResponse.json({ ok: true, id: ins.data?.id || null });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

