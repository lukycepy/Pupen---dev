import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { triggerWebhooks } from '@/lib/webhook';

function isEmail(input: string) {
  const v = String(input || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const BLOCKED_DOMAINS = [
  'mailinator.com',
  '10minutemail.com',
  'guerrillamail.com',
  'tempmail.com',
  'yopmail.com',
  'spam.com'
];

function isBlockedDomain(email: string) {
  const domain = email.split('@')[1];
  if (!domain) return false;
  return BLOCKED_DOMAINS.includes(domain.toLowerCase());
}

function countLinks(input: string) {
  const s = String(input || '');
  const m = s.match(/https?:\/\/[^\s]+/gi);
  return m ? m.length : 0;
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `contact:${ip}`, windowMs: 60_000, max: 10 });
    if (!rl.ok) return NextResponse.json({ error: 'Příliš mnoho požadavků, zkuste to později.' }, { status: 429 });

    const body = await req.json().catch(() => ({}));
    const honeypot = String(body?.website || body?.hp || '').trim();
    if (honeypot) return NextResponse.json({ ok: true });
    const name = String(body?.name || '').trim().slice(0, 120);
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 240);
    const subject = body?.subject != null ? String(body.subject).trim().slice(0, 240) : '';
    const message = String(body?.message || '').trim().slice(0, 10_000);

    if (!name || !email || !message) return NextResponse.json({ error: 'Chybí povinná pole.' }, { status: 400 });
    if (!isEmail(email)) return NextResponse.json({ error: 'Neplatný e-mail.' }, { status: 400 });
    if (isBlockedDomain(email)) return NextResponse.json({ error: 'Tato doména je na seznamu blokovaných kvůli spamu.' }, { status: 400 });
    if (countLinks(message) > 3) return NextResponse.json({ error: 'Zpráva obsahuje příliš mnoho odkazů.' }, { status: 400 });

    const supabase = getServerSupabase();
    const ins = await supabase.from('messages').insert([{ name, email, subject, message }]).select('id, created_at').single();
    if (ins.error) throw ins.error;

    const ps = await supabase.from('payment_settings').select('notification_email').limit(1).maybeSingle();
    const to = ps.data?.notification_email ? String(ps.data.notification_email) : 'info@pupen.org';

    const { subject: mailSubject, html } = await renderEmailTemplateWithDbOverride('contact_message', {
      name,
      email,
      subject,
      message,
      createdAt: ins.data?.created_at,
      messageId: ins.data?.id,
    });

    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'contact' },
      message: { from, to, replyTo: email, subject: mailSubject, html },
    });

    // Trigger webhook asynchronously
    triggerWebhooks('new_message', { name, email, subject, message });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
