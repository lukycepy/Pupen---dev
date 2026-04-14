import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { getPublicBaseUrl } from '@/lib/public-base-url';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function randomToken() {
  return randomBytes(32).toString('base64url');
}

function randomCode() {
  const n = Math.floor(Math.random() * 1_000_000);
  return String(n).padStart(6, '0');
}

function normalizeEmail(input: any) {
  return String(input || '').trim().toLowerCase();
}

function isStudentEmail(email: string) {
  return /^[a-z][a-z]{3}[a-z][0-9]{3}@studenti\.czu\.cz$/i.test(email);
}

function isStaffEmail(email: string, allowedSubdomains: string[]) {
  const m = email.match(/^([a-z0-9._%+-]+)@([a-z0-9-]+)\.czu\.cz$/i);
  if (!m) return false;
  const sub = String(m[2] || '').toLowerCase();
  return allowedSubdomains.includes(sub);
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'trustbox_start',
      windowMs: 60_000,
      max: 10,
      honeypotResponse: { ok: true },
    });
    if (!g.ok) return g.response;
    const body = g.body || {};

    const lang = body?.lang === 'en' ? 'en' : 'cs';
    const firstName = String(body?.firstName || '').trim();
    const lastName = String(body?.lastName || '').trim();
    const email = normalizeEmail(body?.email || '');
    const category = String(body?.category || 'other').trim().slice(0, 80) || 'other';
    const subject = String(body?.subject || '').trim().slice(0, 120);
    const message = String(body?.message || '').trim().slice(0, 10_000);
    const priority = body?.priority === 'urgent' ? 'urgent' : 'normal';
    const allowFollowup = body?.allowFollowup === true;
    const allowForwardToFaculty = body?.allowForwardToFaculty === true;

    if (!firstName || !lastName) return NextResponse.json({ error: lang === 'en' ? 'Missing name' : 'Chybí jméno/příjmení.' }, { status: 400 });
    if (!email) return NextResponse.json({ error: lang === 'en' ? 'Missing email' : 'Chybí e‑mail.' }, { status: 400 });
    if (!subject) return NextResponse.json({ error: lang === 'en' ? 'Missing subject' : 'Chybí předmět.' }, { status: 400 });
    if (!message) return NextResponse.json({ error: lang === 'en' ? 'Missing message' : 'Chybí zpráva.' }, { status: 400 });

    const supabase = getServerSupabase();
    const settingsRes = await supabase
      .from('trust_box_settings')
      .select('allowed_staff_subdomains')
      .eq('id', 1)
      .maybeSingle();
    if (settingsRes.error) throw settingsRes.error;
    const allowedStaffSubdomains = (settingsRes.data as any)?.allowed_staff_subdomains || [];

    let emailType: 'student' | 'staff' | 'unknown' = 'unknown';
    if (isStudentEmail(email)) emailType = 'student';
    else if (isStaffEmail(email, allowedStaffSubdomains)) emailType = 'staff';
    if (emailType === 'unknown') {
      return NextResponse.json({ error: lang === 'en' ? 'Invalid CZU email' : 'Neplatný školní e‑mail (ČZU).' }, { status: 400 });
    }

    const token = randomToken();
    const code = randomCode();
    const tokenHash = sha256Hex(token);
    const codeHash = sha256Hex(code);
    const expiresAt = new Date(Date.now() + 60 * 60_000).toISOString();

    const ins = await supabase
      .from('trust_box_verifications')
      .insert([
        {
          token_hash: tokenHash,
          code_hash: codeHash,
          first_name: firstName,
          last_name: lastName,
          email,
          email_type: emailType,
          draft: {
            category,
            subject,
            message,
            priority,
            allow_followup: allowFollowup,
            allow_forward_to_faculty: allowForwardToFaculty,
          },
          expires_at: expiresAt,
        },
      ])
      .select('id')
      .single();
    if (ins.error) throw ins.error;

    const verifyUrl = `${getPublicBaseUrl()}/${lang}/schranka-duvery/overit?token=${encodeURIComponent(token)}`;
    const { subject: emailSubject, html } = await renderEmailTemplateWithDbOverride('trust_box_verify', {
      toEmail: email,
      firstName,
      verifyUrl,
      code,
      lang,
    });
    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    try {
      await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'trust_box_verify', verificationId: ins.data?.id },
        message: { from, to: email, subject: emailSubject, html },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      verificationToken: token,
      verificationId: ins.data?.id,
      expiresAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

