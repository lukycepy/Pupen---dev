import { NextResponse } from 'next/server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';
import { requireAdmin } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { email, password, firstName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();
    const { subject, html } = renderEmailTemplate('admin_password', { email, password, firstName });

    await transporter.sendMail({
      from,
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}
