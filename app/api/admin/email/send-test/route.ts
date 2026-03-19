import { NextResponse } from 'next/server';
import { getMailer } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { to, templateKey, variables } = body || {};
    if (!to || !templateKey) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const { subject, html } = renderEmailTemplate(templateKey, variables || {});
    const transporter = getMailer();

    await transporter.sendMail({
      from: '"Pupen.org" <info@pupen.org>',
      to,
      subject: `[TEST] ${subject}`,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

