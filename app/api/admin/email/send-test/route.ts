import { NextResponse } from 'next/server';
import { getMailerDebugInfoWithSettings, getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { requireAdmin } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { to, templateKey, variables } = body || {};
    if (!to || !templateKey) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { subject, html } = await renderEmailTemplateWithDbOverride(templateKey, variables || {});
    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    let verified: boolean | null = null;
    try {
      verified = await transporter.verify();
    } catch {
      verified = false;
    }

    await transporter.sendMail({
      from,
      to,
      subject: `[TEST] ${subject}`,
      html,
    });

    return NextResponse.json({ ok: true, verified });
  } catch (e: any) {
    const debug = await getMailerDebugInfoWithSettings();
    return NextResponse.json(
      {
        error: e?.message || 'Error',
        debug,
        details: {
          code: e?.code,
          errno: e?.errno,
          syscall: e?.syscall,
          address: e?.address,
          port: e?.port,
          command: e?.command,
          responseCode: e?.responseCode,
        },
      },
      { status: 500 },
    );
  }
}
