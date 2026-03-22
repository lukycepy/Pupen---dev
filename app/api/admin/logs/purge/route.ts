import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

const EXCLUDED_ACTIONS = [
  'PROMO_RULES',
  'TICKET_EMAIL_BLACKLIST',
  'TICKET_SECURITY_CONFIG',
  'DIGEST_CONFIG',
  'DIGEST_SCHEDULED',
  'REFUND_POLICY',
  'BOARD_DIRECTORY',
  'PROJECT',
  'DM',
  'POLL_VOTE',
  'USER_EMAIL_PREFS',
];

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const olderThanDaysRaw = body?.olderThanDays;
    const dryRun = body?.dryRun !== false;

    const olderThanDays = Math.max(7, Math.min(3650, Number(olderThanDaysRaw || 90) || 90));
    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();

    const supabase = getServerSupabase();

    const countRes = await supabase
      .from('admin_logs')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', cutoffIso)
      .not('action', 'in', `(${EXCLUDED_ACTIONS.map((a) => `"${a}"`).join(',')})`);

    if (countRes.error) throw countRes.error;
    const wouldDelete = Number(countRes.count || 0);

    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, olderThanDays, cutoff: cutoffIso, wouldDelete });
    }

    const delRes = await supabase
      .from('admin_logs')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffIso)
      .not('action', 'in', `(${EXCLUDED_ACTIONS.map((a) => `"${a}"`).join(',')})`);
    if (delRes.error) throw delRes.error;
    const deletedCount = Number(delRes.count || 0);

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'ADMIN_LOGS_PURGE',
          target_id: 'admin_logs',
          details: { olderThanDays, cutoff: cutoffIso, deletedCount, excludedActions: EXCLUDED_ACTIONS },
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true, dryRun: false, olderThanDays, cutoff: cutoffIso, deletedCount });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

