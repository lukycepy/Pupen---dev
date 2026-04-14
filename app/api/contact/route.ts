import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { triggerWebhooks } from '@/lib/webhook';
import { contactFormSchema } from '@/lib/validations/contact';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

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
    const g = await guardPublicJsonPost(req, { keyPrefix: 'contact', windowMs: 60_000, max: 10 });
    if (!g.ok) return g.response;
    const body = g.body;

    const parseResult = contactFormSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { name, email, subject, message } = parseResult.data;

    if (isBlockedDomain(email)) return NextResponse.json({ error: 'Tato doména je na seznamu blokovaných kvůli spamu.' }, { status: 400 });
    if (countLinks(message) > 3) return NextResponse.json({ error: 'Zpráva obsahuje příliš mnoho odkazů.' }, { status: 400 });

    const supabase = getServerSupabase();
    const ins = await supabase.from('messages').insert([{ name, email, subject, message }]).select('id, created_at').single();
    if (ins.error) throw ins.error;

    // Contact Routing dle subjectu (Multi-inbox)
    let routingEmail = 'info@pupen.org'; // Default fallback
    const ps = await supabase.from('payment_settings').select('notification_email').limit(1).maybeSingle();
    if (ps.data?.notification_email) {
      routingEmail = String(ps.data.notification_email);
    }
    
    // Specifické směrování podle klíčových slov v předmětu
    const subjectLower = String(subject || '').toLowerCase();
    if (subjectLower.includes('financ') || subjectLower.includes('platb') || subjectLower.includes('faktur')) {
      routingEmail = 'finance@pupen.org';
    } else if (subjectLower.includes('tech') || subjectLower.includes('web') || subjectLower.includes('chyb')) {
      routingEmail = 'tech@pupen.org';
    } else if (subjectLower.includes('veden') || subjectLower.includes('spoluprac') || subjectLower.includes('board')) {
      routingEmail = 'board@pupen.org';
    }

    // Send notifications to admins
    try {
      const { data: adminProfiles } = await supabase.from('profiles')
        .select('email')
        .or('is_admin.eq.true,can_manage_admins.eq.true');
        
      if (adminProfiles && adminProfiles.length > 0) {
        // Unikátní maily včetně vybraného směrování
        const adminEmailsSet = new Set(adminProfiles.map(p => p.email).filter(Boolean));
        adminEmailsSet.add(routingEmail);
        const adminEmails = Array.from(adminEmailsSet).join(',');
        const transporter = await getMailerWithSettingsOrQueueTransporter();
        const from = await getSenderFromSettings();
        
        const r = await sendMailWithQueueFallback({
          transporter,
          supabase,
          meta: { kind: 'notification' },
          message: { 
            from, 
            to: adminEmails, 
            subject: `Nová zpráva: ${subject}`, 
            html: `
              <h2>Nová zpráva z webu</h2>
              <p><strong>Od:</strong> ${name} (${email})</p>
              <p><strong>Předmět:</strong> ${subject}</p>
              <p><strong>Zpráva:</strong></p>
              <blockquote style="border-left: 4px solid #ccc; padding-left: 1rem; margin-left: 0;">
                ${message.replace(/\n/g, '<br/>')}
              </blockquote>
              <p><a href="https://pupen.org/cs/admin#messages">Odpovědět v administraci</a></p>
            ` 
          },
        });
        if (!r.ok && !r.queued) throw r.error;
      }
    } catch (notifyErr) {
      console.error('Failed to send admin notification:', notifyErr);
    }

    const { subject: mailSubject, html } = await renderEmailTemplateWithDbOverride('contact_message', {
      name,
      email,
      subject,
      message,
      createdAt: ins.data?.created_at,
      messageId: ins.data?.id,
    });

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();

    const r = await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'contact' },
      message: { from, to: routingEmail, replyTo: email, subject: mailSubject, html },
    });
    if (!r.ok && !r.queued) throw r.error;

    // Trigger webhook asynchronously
    triggerWebhooks('new_message', { name, email, subject, message });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
