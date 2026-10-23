import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

interface TrustBoxSettingsRow {
  retention_days?: number | null;
  auto_anonymize?: boolean | null;
  allowed_staff_subdomains?: string[] | null;
}

interface TrustBoxSettingsPatch {
  updated_at: string;
  retention_days?: number;
  auto_anonymize?: boolean;
  allowed_staff_subdomains?: string[];
}

function normalizeSubdomains(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : String(input || '').split(/[,;\s]+/g);
  const out = Array.from(new Set(arr.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean)));
  return out.slice(0, 50);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
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
      .maybeSingle<TrustBoxSettingsRow>();
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, settings: res.data || null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const patch: TrustBoxSettingsPatch = { updated_at: new Date().toISOString() };

    if (body.retention_days != null) {
      const n = Number(body.retention_days);
      if (!Number.isFinite(n)) return NextResponse.json({ error: 'Invalid retention_days' }, { status: 400 });
      patch.retention_days = Math.max(7, Math.min(3650, Math.floor(n)));
    }
    if (body.auto_anonymize != null) {
      patch.auto_anonymize = !!body.auto_anonymize;
    }
    if (body.allowed_staff_subdomains != null) {
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

    await logTrustBoxAudit({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'ADMIN_UPDATE_SETTINGS',
      piiAccessed: false,
      reason: `keys=${Object.keys(patch).filter((k) => k !== 'updated_at').join(',')}`,
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
