import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';
import { EMAIL_TRIGGER_DEFS, type EmailTriggerKey } from '@/lib/email/triggers';
import { listEmailTemplates, type EmailTemplateKey } from '@/lib/email/templates';

function allowedTriggerKeySet() {
  return new Set(EMAIL_TRIGGER_DEFS.map((d) => d.triggerKey));
}

function allowedTemplateKeySet() {
  return new Set(listEmailTemplates().map((t) => String(t.key)));
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const keys = EMAIL_TRIGGER_DEFS.map((d) => d.triggerKey);
    const res = await withSchemaCacheRetry(supabase, () =>
      supabase.from('email_trigger_settings').select('trigger_key, enabled, settings, created_at, updated_at').in('trigger_key', keys as any),
    );
    if (res.error) throw res.error;
    const rows = Array.isArray(res.data) ? res.data : [];

    const byKey = new Map<string, any>();
    for (const r of rows) byKey.set(String((r as any).trigger_key), r);

    const allowedTemplates = allowedTemplateKeySet();
    const triggers = EMAIL_TRIGGER_DEFS.map((d) => {
      const row = byKey.get(d.triggerKey) || null;
      const settings = row?.settings && typeof row.settings === 'object' ? row.settings : {};
      const cs = String(settings?.template_cs || '').trim();
      const en = String(settings?.template_en || '').trim();
      const templateCs = allowedTemplates.has(cs) ? (cs as EmailTemplateKey) : d.defaultTemplateCs;
      const templateEn = allowedTemplates.has(en) ? (en as EmailTemplateKey) : d.defaultTemplateEn;
      return {
        trigger_key: d.triggerKey,
        label: d.label,
        enabled: row?.enabled !== false,
        template_cs: templateCs,
        template_en: templateEn,
        created_at: row?.created_at || null,
        updated_at: row?.updated_at || null,
      };
    });

    return NextResponse.json({ ok: true, triggers });
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
    const triggerKey = String(body?.trigger_key || body?.triggerKey || '').trim() as EmailTriggerKey;
    const enabled = body?.enabled != null ? !!body.enabled : true;
    const templateCs = String(body?.template_cs || body?.templateCs || '').trim();
    const templateEn = String(body?.template_en || body?.templateEn || '').trim();

    const allowedTriggers = allowedTriggerKeySet();
    if (!allowedTriggers.has(triggerKey)) return NextResponse.json({ error: 'Invalid trigger key' }, { status: 400 });

    const allowedTemplates = allowedTemplateKeySet();
    if (templateCs && !allowedTemplates.has(templateCs)) return NextResponse.json({ error: 'Invalid CS template key' }, { status: 400 });
    if (templateEn && !allowedTemplates.has(templateEn)) return NextResponse.json({ error: 'Invalid EN template key' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date().toISOString();
    const settings = { template_cs: templateCs || null, template_en: templateEn || null };
    const up = await withSchemaCacheRetry(supabase, () =>
      supabase
        .from('email_trigger_settings')
        .upsert([{ trigger_key: triggerKey, enabled, settings, updated_at: now }], { onConflict: 'trigger_key' })
        .select('trigger_key, enabled, settings, created_at, updated_at')
        .single(),
    );
    if (up.error) throw up.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'EMAIL_TRIGGER_UPSERT',
          target_id: triggerKey,
          details: { trigger_key: triggerKey, enabled, template_cs: templateCs || null, template_en: templateEn || null },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, trigger: up.data });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

