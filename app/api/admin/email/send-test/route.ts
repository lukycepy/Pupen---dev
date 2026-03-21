import { NextResponse } from 'next/server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';
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

    const { subject, html } = renderEmailTemplate(templateKey, variables || {});
    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    await transporter.sendMail({
      from,
      to,
      subject: `[TEST] ${subject}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
