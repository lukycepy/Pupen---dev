import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { getMailer } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { isEmailBlacklisted } from '@/lib/tickets/blacklist';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `refund:${user.id}:${ip}`, windowMs: 10 * 60 * 1000, max: 5 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { rsvpId, eventId, eventTitle, reason, note } = body || {};
    if (!rsvpId || !eventId || !eventTitle || !reason) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();

    const bl = await supabase
      .from('admin_logs')
      .select('details')
      .eq('action', 'TICKET_EMAIL_BLACKLIST')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const entries = Array.isArray(bl.data?.details?.entries) ? bl.data?.details?.entries : [];
    const requesterEmail = (user.email || '').toLowerCase();
    if (requesterEmail && isEmailBlacklisted(requesterEmail, entries)) {
      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: requesterEmail,
            admin_name: 'Refund',
            action: 'REFUND_BLOCKED',
            target_id: String(rsvpId),
            details: { reason: 'blacklist', email: requesterEmail, eventId: String(eventId), createdAt: new Date().toISOString() },
          },
        ]);
      } catch {}
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: emailSettings } = await supabase.from('email_settings').select('*').maybeSingle();
    const { data: paymentSettings } = await supabase.from('payment_settings').select('notification_email').maybeSingle();

    const toEmail = paymentSettings?.notification_email || process.env.INVOICE_EMAIL || process.env.SMTP_USER || 'info@pupen.org';
    const replyTo = user.email || '';

    const { subject, html } = await renderEmailTemplateWithDbOverride('refund_request', {
      toEmail,
      replyTo,
      rsvpId,
      eventId,
      eventTitle,
      email: replyTo,
      reason,
      note,
    });

    const host = emailSettings?.smtp_host || process.env.SMTP_HOST;
    const smtpUser = emailSettings?.smtp_user || process.env.SMTP_USER;
    const pass = emailSettings?.smtp_pass || process.env.SMTP_PASS;
    const port = Number(emailSettings?.smtp_port || process.env.SMTP_PORT) || 587;
    const secure = (emailSettings?.smtp_secure ?? null) === true || port === 465;

    const transporter = getMailer({ host, user: smtpUser, pass, port, secure });

    const fromName = emailSettings?.sender_name || 'Pupen.org';
    const fromEmail = emailSettings?.sender_email || 'info@pupen.org';

    await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'refund_request' },
      message: { from: `"${fromName}" <${fromEmail}>`, to: toEmail, replyTo: replyTo || undefined, subject, html },
    });

    const payload = {
      rsvpId: String(rsvpId),
      eventId: String(eventId),
      eventTitle: String(eventTitle),
      reason: String(reason),
      note: note ? String(note) : null,
      status: 'open',
      createdAt: new Date().toISOString(),
      requester: { id: user.id, email: user.email },
    };

    const log = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'member',
        admin_name: 'Refund',
        action: 'REFUND_REQUEST',
        target_id: String(rsvpId),
        details: payload,
      },
    ]);
    if (log.error) throw log.error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
