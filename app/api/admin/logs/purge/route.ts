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
    const { user } = await requireAdmin(req);

    const body = await req.json().catch(() => ({}));
    const source = String(body?.source || 'admin');
    const olderThanDaysRaw = body?.olderThanDays;
    const dryRun = body?.dryRun !== false;

    const olderThanDays = Math.max(7, Math.min(3650, Number(olderThanDaysRaw || 90) || 90));
    const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const cutoffIso = new Date(cutoffMs).toISOString();

    const supabase = getServerSupabase();

    const profRes = await supabase
      .from('profiles')
      .select('can_manage_admins, can_edit_logs')
      .eq('id', user.id)
      .maybeSingle();
    if (profRes.error) throw profRes.error;
    const profile = profRes.data as any;
    const canEdit = !!(profile?.can_manage_admins || profile?.can_edit_logs);
    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (source === 'admin') {
      const countRes = await supabase
        .from('admin_logs')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', cutoffIso)
        .not('action', 'in', `(${EXCLUDED_ACTIONS.map((a) => `"${a}"`).join(',')})`);
      if (countRes.error) throw countRes.error;
      const wouldDelete = Number(countRes.count || 0);

      if (dryRun) {
        return NextResponse.json({ ok: true, dryRun: true, source, olderThanDays, cutoff: cutoffIso, wouldDelete });
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
            action: 'LOGS_PURGE',
            target_id: 'admin_logs',
            details: { source, olderThanDays, cutoff: cutoffIso, deletedCount, excludedActions: EXCLUDED_ACTIONS },
          },
        ]);
      } catch {}

      return NextResponse.json({ ok: true, dryRun: false, source, olderThanDays, cutoff: cutoffIso, deletedCount });
    }

    if (source === 'error') {
      const countRes = await supabase
        .from('error_logs')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', cutoffIso);
      if (countRes.error) throw countRes.error;
      const wouldDelete = Number(countRes.count || 0);
      if (dryRun) return NextResponse.json({ ok: true, dryRun: true, source, olderThanDays, cutoff: cutoffIso, wouldDelete });

      const delRes = await supabase.from('error_logs').delete({ count: 'exact' }).lt('created_at', cutoffIso);
      if (delRes.error) throw delRes.error;
      const deletedCount = Number(delRes.count || 0);

      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: user.email || 'admin',
            admin_name: user.user_metadata?.full_name || user.email || 'admin',
            action: 'LOGS_PURGE',
            target_id: 'error_logs',
            details: { source, olderThanDays, cutoff: cutoffIso, deletedCount },
          },
        ]);
      } catch {}

      return NextResponse.json({ ok: true, dryRun: false, source, olderThanDays, cutoff: cutoffIso, deletedCount });
    }

    if (source === 'server') {
      const level = String(body?.level || '').trim();
      const category = String(body?.category || '').trim();

      let countQ = supabase.from('server_logs').select('id', { count: 'exact', head: true }).lt('created_at', cutoffIso);
      if (level) countQ = countQ.eq('level', level);
      if (category) countQ = countQ.eq('category', category);
      const countRes = await countQ;
      if (countRes.error) throw countRes.error;
      const wouldDelete = Number(countRes.count || 0);
      if (dryRun) return NextResponse.json({ ok: true, dryRun: true, source, olderThanDays, cutoff: cutoffIso, wouldDelete });

      let delQ = supabase.from('server_logs').delete({ count: 'exact' }).lt('created_at', cutoffIso);
      if (level) delQ = delQ.eq('level', level);
      if (category) delQ = delQ.eq('category', category);
      const delRes = await delQ;
      if (delRes.error) throw delRes.error;
      const deletedCount = Number(delRes.count || 0);

      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: user.email || 'admin',
            admin_name: user.user_metadata?.full_name || user.email || 'admin',
            action: 'LOGS_PURGE',
            target_id: 'server_logs',
            details: { source, olderThanDays, cutoff: cutoffIso, deletedCount, level: level || null, category: category || null },
          },
        ]);
      } catch {}

      return NextResponse.json({ ok: true, dryRun: false, source, olderThanDays, cutoff: cutoffIso, deletedCount });
    }

    return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
