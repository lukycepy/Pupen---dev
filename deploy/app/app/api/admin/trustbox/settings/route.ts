import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function normalizeSubdomains(input: any): string[] {
  const arr = Array.isArray(input) ? input : String(input || '').split(/[,;\s]+/g);
  const out = Array.from(new Set(arr.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)));
  return out.slice(0, 50);
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const supabase = getServerSupabase();
    const res = await supabase
      .from('trust_box_settings')
      .select('retention_days, auto_anonymize, allowed_staff_subdomains')
      .eq('id', 1)
      .maybeSingle();
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, settings: res.data || null });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const patch: any = { updated_at: new Date().toISOString() };

    if (body?.retention_days != null) {
      const n = Number(body.retention_days);
      if (!Number.isFinite(n)) return NextResponse.json({ error: 'Invalid retention_days' }, { status: 400 });
      patch.retention_days = Math.max(7, Math.min(3650, Math.floor(n)));
    }
    if (body?.auto_anonymize != null) {
      patch.auto_anonymize = !!body.auto_anonymize;
    }
    if (body?.allowed_staff_subdomains != null) {
      patch.allowed_staff_subdomains = normalizeSubdomains(body.allowed_staff_subdomains);
    }

    const supabase = getServerSupabase();
    const up = await supabase.from('trust_box_settings').update(patch).eq('id', 1);
    if (up.error) throw up.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'TRUSTBOX_SETTINGS_UPDATE',
          target_id: 'trust_box_settings:1',
          details: { keys: Object.keys(patch).filter((k) => k !== 'updated_at') },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

