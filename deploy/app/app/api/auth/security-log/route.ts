import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { getBearerToken } from '@/lib/server-auth';

const ALLOWED_EVENTS = new Set([
  'MFA_ENROLL_START',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'PASSKEY_REGISTER_START',
  'PASSKEY_REGISTERED',
  'PASSKEY_REMOVED',
  'GOOGLE_LINK_START',
  'GOOGLE_LINK_UNSUPPORTED',
  'GOOGLE_LINK_ERROR',
  'LOGIN_SUCCESS',
  'LOGIN_BLOCKED',
  'LOGIN_NO_ACCESS',
  'LOGOUT',
  'PERFORMANCE_METRIC',
]);

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'security_log',
      windowMs: 60_000,
      max: 60,
      honeypot: false,
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const event = String(body?.event || '');
    if (!ALLOWED_EVENTS.has(event)) return NextResponse.json({ error: 'Invalid event' }, { status: 400 });

    // Allow PERFORMANCE_METRIC without full user auth (might be anonymous session)
    let user: any = null;
    if (event !== 'PERFORMANCE_METRIC') {
      user = await requireUser(req);
    } else {
      const supabase = getServerSupabase();
      const token = getBearerToken(req);
      if (token) {
        const r = await supabase.auth.getUser(token);
        user = r.data?.user || null;
      }
    }

    const detailsRaw = body?.details;
    const details = detailsRaw && typeof detailsRaw === 'object' ? detailsRaw : {};
    const detailsSize = JSON.stringify(details).length;
    if (detailsSize > 4000) return NextResponse.json({ error: 'Details too large' }, { status: 400 });

    const supabase = getServerSupabase();
    const ins = await supabase
      .from('user_security_logs')
      .insert([
        {
          user_id: user?.id || null,
          user_email: user?.email || null,
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
