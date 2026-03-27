import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function randomToken() {
  return createHash('sha256').update(String(crypto.randomUUID()) + String(Date.now())).digest('hex');
}

async function findUserIdByEmail(supabase: any, email: string) {
  const perPage = 200;
  for (let page = 1; page <= 10; page += 1) {
    const res = await supabase.auth.admin.listUsers({ page, perPage });
    if (res.error) throw res.error;
    const users = res.data?.users || [];
    const u = users.find((x: any) => String(x?.email || '').toLowerCase() === email.toLowerCase());
    if (u?.id) return String(u.id);
    if (users.length < perPage) return null;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const lang = body?.lang === 'en' ? 'en' : 'cs';
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
    const resetUrl = String((gen.data as any)?.properties?.action_link || '');
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
          target_id: String((gen.data as any)?.user?.id || email),
          details: { email, queued: !r.ok && !!r.queued },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
