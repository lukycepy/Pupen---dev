import { NextResponse } from 'next/server';
import { getMailerDebugInfoWithSettings, getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { email, password, firstName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    const { subject, html } = await renderEmailTemplateWithDbOverride('admin_password', { email, password, firstName });

    const supabase = getServerSupabase();
    const sendRes = await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'admin_password' },
      message: { from, to: email, subject, html },
    });
    if (!sendRes.ok) {
      const smtp = await getMailerDebugInfoWithSettings().catch(() => null);
      const sendError = toRecord(sendRes.error);
      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: user.email || 'admin',
            admin_name: 'Uživatelé',
            action: 'USER_PASSWORD_SEND_FAILED',
            target_id: String(email),
            details: {
              email,
              smtp,
              details: {
                code: sendError.code ? String(sendError.code) : null,
                errno: sendError.errno ? String(sendError.errno) : null,
                syscall: sendError.syscall ? String(sendError.syscall) : null,
                address: sendError.address ? String(sendError.address) : null,
                port: sendError.port ? String(sendError.port) : null,
                command: sendError.command ? String(sendError.command) : null,
                responseCode: typeof sendError.responseCode === 'number' ? sendError.responseCode : null,
              },
              error: sendError.message ? String(sendError.message) : 'Email send failed',
              queued: sendRes.queued === true,
            },
          },
        ]);
      } catch {}
      if (sendRes.queued !== true) throw sendRes.error;
    }

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: 'Uživatelé',
          action: 'USER_PASSWORD_SENT',
          target_id: String(email),
          details: { email, queued: !sendRes.ok && sendRes.queued === true },
        },
      ]);
    } catch {}

    return NextResponse.json({ success: true, queued: !sendRes.ok && sendRes.queued === true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
