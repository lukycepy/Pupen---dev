import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { requireAdmin } from '@/lib/server-auth';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 240);
    const name = String(body?.name || '').trim().slice(0, 160);
    const eventTitle = String(body?.eventTitle || '').trim().slice(0, 240);
    const attendees = body?.attendees;
    const paymentMethod = String(body?.paymentMethod || '').trim().slice(0, 80);
    const qrToken = String(body?.qrToken || '').trim().slice(0, 500);
    const status = String(body?.status || '').trim().slice(0, 80);

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Neplatný e-mail.' }, { status: 400 });
    }

    let bankAccount = process.env.BANK_ACCOUNT || 'CZ1234567890';
    try {
      const supabase = getServerSupabase();
      const { data } = await supabase.from('payment_settings').select('bank_account').single();
      if (data?.bank_account) bankAccount = String(data.bank_account);
    } catch {}

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();

    const { subject, html } = await renderEmailTemplateWithDbOverride('ticket', {
      email,
      name,
      eventTitle,
      attendees,
      paymentMethod,
      qrToken,
      status,
      bankAccount,
    });

    await sendMailWithQueueFallback({
      transporter,
      supabase: getServerSupabase(),
      meta: { kind: 'ticket' },
      message: { from, to: email, subject, html },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error?.message === 'Unauthorized' ? 401 : error?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: error?.message || 'Error' }, { status });
  }
}
