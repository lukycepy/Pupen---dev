import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { listEmailTemplates } from '@/lib/email/templates';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes('Could not find the table') && msg.includes('in the schema cache');
}

function allowedKeys() {
  return new Set(listEmailTemplates().map((t) => String(t.key)));
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const supabase = getServerSupabase();
    const res = await supabase
      .from('email_template_overrides')
      .select('template_key, subject, html, is_enabled, created_at, updated_at')
      .order('template_key', { ascending: true });
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true, overrides: res.data || [] });
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) {
      return NextResponse.json(
        { error: 'Chybí tabulka email_template_overrides. Spusť migraci `migrace/38_email_template_overrides.sql` v Supabase.' },
        { status: 501 },
      );
    }
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const templateKey = String(body?.template_key || body?.templateKey || '').trim();
    const subject = String(body?.subject || '');
    const html = String(body?.html || '');
    const isEnabled = body?.is_enabled != null ? !!body.is_enabled : body?.isEnabled != null ? !!body.isEnabled : true;

    const allowed = allowedKeys();
    if (!allowed.has(templateKey)) return NextResponse.json({ error: 'Invalid template key' }, { status: 400 });

    const supabase = getServerSupabase();
    const now = new Date().toISOString();
    const up = await supabase
      .from('email_template_overrides')
      .upsert([{ template_key: templateKey, subject, html, is_enabled: isEnabled, updated_at: now }], { onConflict: 'template_key' })
      .select('template_key, subject, html, is_enabled, created_at, updated_at')
      .single();
    if (up.error) throw up.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'EMAIL_TEMPLATE_UPSERT',
          target_id: templateKey,
          details: { template_key: templateKey, is_enabled: isEnabled },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, override: up.data });
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) {
      return NextResponse.json(
        { error: 'Chybí tabulka email_template_overrides. Spusť migraci `migrace/38_email_template_overrides.sql` v Supabase.' },
        { status: 501 },
      );
    }
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

