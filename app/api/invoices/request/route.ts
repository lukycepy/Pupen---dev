import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { isEmailBlacklisted } from '@/lib/tickets/blacklist';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `invoice:${ip}`, windowMs: 10 * 60 * 1000, max: 10 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json();
    const {
      rsvpId,
      eventId,
      eventTitle,
      email,
      buyerType,
      buyerName,
      buyerAddress,
      ico,
      dic,
      note,
    } = body || {};

    if (!rsvpId || !eventTitle || !email || !buyerType || !buyerName || !buyerAddress) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const bl = await supabase
      .from('admin_logs')
      .select('details')
      .eq('action', 'TICKET_EMAIL_BLACKLIST')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const entries = Array.isArray(bl.data?.details?.entries) ? bl.data?.details?.entries : [];
    const requesterEmail = String(email || '').trim().toLowerCase();
    if (requesterEmail && isEmailBlacklisted(requesterEmail, entries)) {
      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: requesterEmail,
            admin_name: 'Invoice',
            action: 'INVOICE_BLOCKED',
            target_id: String(rsvpId),
            details: { reason: 'blacklist', email: requesterEmail, eventId: String(eventId || ''), createdAt: new Date().toISOString() },
          },
        ]);
      } catch {}
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: settings } = await supabase
      .from('payment_settings')
      .select('notification_email, bank_account')
      .single();

    const toEmail = settings?.notification_email || process.env.INVOICE_EMAIL || process.env.SMTP_USER || 'info@pupen.org';
    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();
    const { subject, html } = await renderEmailTemplateWithDbOverride('invoice_request', {
      toEmail,
      replyTo: email,
      rsvpId,
      eventId,
      eventTitle,
      email,
      buyerType,
      buyerName,
      buyerAddress,
      ico,
      dic,
      note,
    });

    await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'invoice_request' },
      message: { from, to: toEmail, replyTo: email, subject, html },
    });

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: 'invoice-request',
          admin_name: 'Invoice',
          action: `Žádost o fakturu: ${rsvpId}`,
          target_id: String(rsvpId),
          details: {
            eventId,
            eventTitle,
            email,
            buyerType,
            buyerName,
            buyerAddress,
            ico,
            dic,
            note,
          },
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
