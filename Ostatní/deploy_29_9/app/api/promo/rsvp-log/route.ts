import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const { eventId, promoCode, email, attendeesCount, status } = body || {};
    if (!eventId || !promoCode) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'member',
        admin_name: 'Promo',
        action: 'PROMO_RSVP',
        target_id: String(eventId),
        details: {
          eventId: String(eventId),
          promoCode: String(promoCode).slice(0, 60),
          email: email ? String(email) : user.email,
          attendeesCount: typeof attendeesCount === 'number' ? attendeesCount : null,
          status: status ? String(status) : null,
          userId: user.id,
          createdAt: new Date().toISOString(),
        },
      },
    ]);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

