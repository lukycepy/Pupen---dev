import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

interface SendResetBody {
  email?: unknown;
  lang?: unknown;
}

interface GenerateLinkData {
  user?: { id?: string | null } | null;
  properties?: { action_link?: string | null } | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const body = toRecord(await req.json().catch(() => ({}))) as SendResetBody;
    const email = String(body.email || '').trim().toLowerCase();
    const lang = body.lang === 'en' ? 'en' : 'cs';
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const supabase = getServerSupabase();
    const origin = new URL(req.url).origin;
    const redirectTo = `${origin}/${lang}/reset-password`;
    const gen = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });
    if (gen.error) return NextResponse.json({ ok: true });
    const genData = gen.data as GenerateLinkData | null;
    const resetUrl = String(genData?.properties?.action_link || '');
    if (!resetUrl) return NextResponse.json({ ok: true });

    const { subject, html } = await renderEmailTemplateWithDbOverride('password_reset', { email, resetUrl, lang });
    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    const r = await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'password_reset' },
      message: { from, to: email, subject, html },
    });
    if (!r.ok && !r.queued) throw r.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'USER_PASSWORD_RESET_SENT',
          target_id: String(genData?.user?.id || email),
          details: { email, queued: !r.ok && !!r.queued },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
