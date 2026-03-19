import { NextResponse } from 'next/server';
import { getMailer } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';

export async function POST(req: Request) {
  try {
    const { email, password, firstName } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing email or password' }, { status: 400 });
    }

    const transporter = getMailer();
    const { subject, html } = renderEmailTemplate('admin_password', { email, password, firstName });

    await transporter.sendMail({
      from: '"Pupen Control" <info@pupen.org>',
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
