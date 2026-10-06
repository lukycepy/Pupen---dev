import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const { targetType, targetId, targetLabel, reason, details, sourceUrl } = body || {};

    if (!targetType || !targetId || !reason) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const payload = {
      reporterEmail: String(user.email || ''),
      reporterId: String(user.id),
      targetType: String(targetType),
      targetId: String(targetId),
      targetLabel: targetLabel ? String(targetLabel) : null,
      reason: String(reason),
      details: details ? String(details) : null,
      sourceUrl: sourceUrl ? String(sourceUrl) : null,
      status: 'open',
    };

    const { data, error } = await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: 'report',
          admin_name: 'Report',
          action: `REPORT:${payload.targetType}`,
          target_id: payload.targetId,
          details: payload,
        },
      ])
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
