import { NextResponse } from 'next/server';
import { getMailerDebugInfoWithSettings, getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { email, password, firstName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const transporter = await getMailerWithSettings();
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
                code: sendRes.error?.code,
                errno: sendRes.error?.errno,
                syscall: sendRes.error?.syscall,
                address: sendRes.error?.address,
                port: sendRes.error?.port,
                command: sendRes.error?.command,
                responseCode: sendRes.error?.responseCode,
              },
              error: sendRes.error?.message || 'Email send failed',
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
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
