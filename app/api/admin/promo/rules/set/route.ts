import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { normalizePromoRules } from '@/lib/promo/rules';

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const rules = normalizePromoRules(body?.rules);

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'PromoRules',
        action: 'PROMO_RULES',
        target_id: null,
        details: { rules, updatedAt: new Date().toISOString() },
      },
    ]);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

