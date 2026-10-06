import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

function addMonths(date: Date, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const memberId = String(url.searchParams.get('memberId') || '').trim();
    const supabase = getServerSupabase();
    let q = supabase.from('membership_payments').select('*').order('paid_at', { ascending: false }).limit(200);
    if (memberId) q = q.eq('member_id', memberId);
    const res = await q;
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, payments: res.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const memberId = String(body?.memberId || body?.member_id || '').trim();
    const months = Math.min(Math.max(Number(body?.months || 12), 1), 60);
    const amount = Number(body?.amount ?? 0);
    const currency = String(body?.currency || 'CZK').slice(0, 8);
    const paidAt = body?.paidAt ? new Date(String(body.paidAt)) : new Date();
    if (!memberId) return NextResponse.json({ error: 'Missing memberId' }, { status: 400 });
    if (Number.isNaN(paidAt.getTime())) return NextResponse.json({ error: 'Invalid paidAt' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date();

    const profRes = await supabase.from('profiles').select('member_expires_at').eq('id', memberId).maybeSingle();
    if (profRes.error) throw profRes.error;
    const curExpRaw = (profRes.data as any)?.member_expires_at ? new Date(String((profRes.data as any).member_expires_at)) : null;
    const base = curExpRaw && curExpRaw > now ? curExpRaw : now;
    const nextExp = addMonths(base, months);

    const periodStart = base.toISOString();
    const periodEnd = nextExp.toISOString();

    const ins = await supabase
      .from('membership_payments')
      .insert([
        {
          member_id: memberId,
          provider: 'manual',
          paid_at: paidAt.toISOString(),
          amount: Number.isFinite(amount) ? amount : 0,
          currency,
          period_start: periodStart,
          period_end: periodEnd,
          raw: body || {},
          updated_at: new Date().toISOString(),
        },
      ])
      .select('*')
      .single();
    if (ins.error) throw ins.error;

    await supabase
      .from('profiles')
      .update({ member_expires_at: periodEnd, member_expiry_notice_stage: null, member_expiry_notice_at: null })
      .eq('id', memberId);

    await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: user.user_metadata?.full_name || user.email || 'admin',
        action: 'MEMBERSHIP_PAYMENT_MANUAL',
        target_id: memberId,
        details: { amount, currency, months, paidAt: paidAt.toISOString(), member_expires_at: periodEnd, payment_id: ins.data?.id },
      },
    ]);

    return NextResponse.json({ ok: true, payment: ins.data, member_expires_at: periodEnd });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

