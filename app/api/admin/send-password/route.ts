import { NextResponse } from 'next/server';
import { getMailerDebugInfoWithSettings, getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';
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
    const { subject, html } = renderEmailTemplate('admin_password', { email, password, firstName });

    try {
      await transporter.sendMail({
        from,
        to: email,
        subject,
        html,
      });
    } catch (e: any) {
      const supabase = getServerSupabase();
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
                code: e?.code,
                errno: e?.errno,
                syscall: e?.syscall,
                address: e?.address,
                port: e?.port,
                command: e?.command,
                responseCode: e?.responseCode,
              },
              error: e?.message || 'Email send failed',
            },
          },
        ]);
      } catch {}
      throw e;
    }

    const supabase = getServerSupabase();
    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: 'Uživatelé',
          action: 'USER_PASSWORD_SENT',
          target_id: String(email),
          details: { email },
        },
      ]);
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
