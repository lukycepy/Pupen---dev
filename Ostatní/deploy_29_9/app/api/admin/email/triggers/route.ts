import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';
import { EMAIL_TRIGGER_DEFS, type EmailTriggerKey } from '@/lib/email/triggers';
import { listEmailTemplates, type EmailTemplateKey } from '@/lib/email/templates';

interface EmailTriggerSettingsRow {
  trigger_key?: string | null;
  enabled?: boolean | null;
  settings?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface EmailTriggerBody {
  trigger_key?: unknown;
  triggerKey?: unknown;
  enabled?: unknown;
  template_cs?: unknown;
  templateCs?: unknown;
  template_en?: unknown;
  templateEn?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function isEmailTriggerKey(value: string): value is EmailTriggerKey {
  return allowedTriggerKeySet().has(value as EmailTriggerKey);
}

function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return allowedTemplateKeySet().has(value as EmailTemplateKey);
}

function allowedTriggerKeySet() {
  return new Set(EMAIL_TRIGGER_DEFS.map((d) => d.triggerKey));
}

function allowedTemplateKeySet() {
  return new Set<EmailTemplateKey>(listEmailTemplates().map((t) => t.key));
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const keys = EMAIL_TRIGGER_DEFS.map((d) => d.triggerKey);
    const res = await withSchemaCacheRetry(supabase, () =>
      supabase.from('email_trigger_settings').select('trigger_key, enabled, settings, created_at, updated_at').in('trigger_key', keys),
    );
    if (res.error) throw res.error;
    const rows: EmailTriggerSettingsRow[] = Array.isArray(res.data) ? res.data : [];

    const byKey = new Map<string, EmailTriggerSettingsRow>();
    for (const row of rows) byKey.set(String(row.trigger_key || ''), row);

    const triggers = EMAIL_TRIGGER_DEFS.map((d) => {
      const row = byKey.get(d.triggerKey) || null;
      const settings = toRecord(row?.settings);
      const cs = String(settings.template_cs || '').trim();
      const en = String(settings.template_en || '').trim();
      const templateCs = isEmailTemplateKey(cs) ? cs : d.defaultTemplateCs;
      const templateEn = isEmailTemplateKey(en) ? en : d.defaultTemplateEn;
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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = body as EmailTriggerBody;
    const triggerKey = String(payload.trigger_key || payload.triggerKey || '').trim();
    const enabled = payload.enabled != null ? !!payload.enabled : true;
    const templateCs = String(payload.template_cs || payload.templateCs || '').trim();
    const templateEn = String(payload.template_en || payload.templateEn || '').trim();

    if (!isEmailTriggerKey(triggerKey)) return NextResponse.json({ error: 'Invalid trigger key' }, { status: 400 });

    if (templateCs && !isEmailTemplateKey(templateCs)) return NextResponse.json({ error: 'Invalid CS template key' }, { status: 400 });
    if (templateEn && !isEmailTemplateKey(templateEn)) return NextResponse.json({ error: 'Invalid EN template key' }, { status: 400 });

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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
