import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailer } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';

export async function POST(req: Request) {
  try {
    const { email, name, eventTitle, attendees, paymentMethod, qrToken, status } = await req.json();

    let bankAccount = process.env.BANK_ACCOUNT || 'CZ1234567890';
    try {
      const supabase = getServerSupabase();
      const { data } = await supabase.from('payment_settings').select('bank_account').single();
      if (data?.bank_account) bankAccount = String(data.bank_account);
    } catch {}

    const transporter = getMailer();

    const { subject, html } = renderEmailTemplate('ticket', {
      email,
      name,
      eventTitle,
      attendees,
      paymentMethod,
      qrToken,
      status,
      bankAccount,
    });

    await transporter.sendMail({
      from: '"Pupen.org" <info@pupen.org>',
      to: email,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to send ticket email:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
