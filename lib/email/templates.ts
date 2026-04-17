import { formatDatePrague, formatDateTimePrague } from '@/lib/time/prague';

export type EmailTemplateKey =
  | 'ticket'
  | 'admin_password'
  | 'password_reset'
  | 'trust_box_verify'
  | 'trust_box_confirm'
  | 'trust_box_admin_reply'
  | 'member_access'
  | 'member_welcome'
  | 'membership_expiry'
  | 'application_received'
  | 'application_new_admin'
  | 'application_approved_access'
  | 'application_status'
  | 'application_status_admin'
  | 'invoice_request'
  | 'refund_request'
  | 'refund_status'
  | 'contact_message'
  | 'newsletter';

export function listEmailTemplates() {
  return [
    {
      key: 'ticket' as const,
      label: 'Vstupenka / RSVP',
      variables: [
        'email',
        'name',
        'eventTitle',
        'attendees',
        'paymentMethod',
        'qrToken',
        'status',
        'bankAccount',
      ],
    },
    {
      key: 'admin_password' as const,
      label: 'Admin přístup (heslo)',
      variables: ['email', 'firstName', 'password'],
    },
    {
      key: 'password_reset' as const,
      label: 'Reset hesla',
      variables: ['email', 'resetUrl', 'lang'],
    },
    {
      key: 'trust_box_verify' as const,
      label: 'Schránka důvěry – ověření e‑mailu',
      variables: ['toEmail', 'firstName', 'verifyUrl', 'code', 'lang'],
    },
    {
      key: 'trust_box_confirm' as const,
      label: 'Schránka důvěry – potvrzení',
      variables: ['toEmail', 'firstName', 'threadUrl', 'lang'],
    },
    {
      key: 'trust_box_admin_reply' as const,
      label: 'Schránka důvěry – odpověď správce',
      variables: ['toEmail', 'firstName', 'threadUrl', 'lang'],
    },
    {
      key: 'member_access' as const,
      label: 'Člen – aktivace přístupu',
      variables: ['toEmail', 'firstName', 'actionUrl', 'lang'],
    },
    {
      key: 'member_welcome' as const,
      label: 'Člen – welcome',
      variables: ['toEmail', 'firstName', 'lang'],
    },
    {
      key: 'membership_expiry' as const,
      label: 'Členství – expirace',
      variables: ['toEmail', 'firstName', 'expiresAt', 'daysLeft', 'lang'],
    },
    {
      key: 'application_status' as const,
      label: 'Přihláška – změna stavu',
      variables: ['toEmail', 'firstName', 'status', 'reason', 'lang'],
    },
    {
      key: 'application_status_admin' as const,
      label: 'Přihláška: změna stavu (admin)',
      variables: ['toEmail', 'firstName', 'lastName', 'status', 'reason', 'adminLink', 'lang'],
    },
    {
      key: 'application_received' as const,
      label: 'Přihláška – potvrzení uchazeči',
      variables: ['toEmail', 'firstName', 'lastName', 'lang'],
    },
    {
      key: 'application_new_admin' as const,
      label: 'Přihláška – upozornění předseda/admin',
      variables: ['toEmail', 'firstName', 'lastName', 'membershipType', 'adminLink', 'lang'],
    },
    {
      key: 'application_approved_access' as const,
      label: 'Přihláška – schválení + přístup + PDF',
      variables: ['toEmail', 'firstName', 'lastName', 'actionUrl', 'pdfUrl', 'lang'],
    },
    {
      key: 'invoice_request' as const,
      label: 'Žádost o fakturu (interní)',
      variables: ['toEmail', 'replyTo', 'rsvpId', 'eventId', 'eventTitle', 'email', 'buyerType', 'buyerName', 'buyerAddress', 'ico', 'dic', 'note'],
    },
    {
      key: 'refund_request' as const,
      label: 'Žádost o refund (interní)',
      variables: ['toEmail', 'replyTo', 'rsvpId', 'eventId', 'eventTitle', 'email', 'reason', 'note'],
    },
    {
      key: 'refund_status' as const,
      label: 'Refund – změna stavu (žadatel)',
      variables: ['toEmail', 'refundLogId', 'rsvpId', 'eventId', 'eventTitle', 'status', 'amount', 'currency', 'note'],
    },
    {
      key: 'contact_message' as const,
      label: 'Kontakt – nová zpráva (interní)',
      variables: ['name', 'email', 'subject', 'message', 'createdAt', 'messageId'],
    },
    {
      key: 'newsletter' as const,
      label: 'Newsletter',
      variables: ['subject', 'preheader', 'html', 'unsubLink', 'preferencesLink', 'variant'],
    },
  ];
}

function escapeHtml(input: any) {
  return String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function section(label: string, value: any) {
  return `<p style="margin: 8px 0;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`;
}

function bulletproofButton(href: string, label: string) {
  const h = String(href || '').trim();
  const l = String(label || '').trim();
  if (!h || !l) return '';
  const width = Math.max(180, Math.min(520, l.length * 9 + 80));
  const eh = escapeHtml(h);
  const el = escapeHtml(l);
  return `<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${eh}" style="height:44px;v-text-anchor:middle;width:${width}px;" arcsize="32%" stroke="f" fillcolor="#16a34a">
<w:anchorlock/>
<center style="color:#ffffff;font-family:Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${el}</center>
</v:roundrect>
<![endif]--><!--[if !mso]><!-- -->
<a href="${eh}" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;padding:14px 18px;border-radius:14px;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;font-size:12px;font-family:Arial,sans-serif;">${el}</a>
<!--<![endif]-->`;
}

function emailDoc(opts: {
  subject: string;
  title: string;
  preheader?: string;
  badge?: string;
  introHtml?: string;
  contentHtml?: string;
  cta?: { href: string; label: string };
  secondaryCta?: { href: string; label: string };
  footerText?: string;
  footerHtml?: string;
  toEmail?: string;
  lang?: 'cs' | 'en';
}) {
  const subject = String(opts.subject || '').trim();
  const title = String(opts.title || '').trim();
  const preheader = String(opts.preheader || '').trim();
  const badge = String(opts.badge || '').trim();
  const introHtml = String(opts.introHtml || '').trim();
  const contentHtml = String(opts.contentHtml || '').trim();
  const footerText = String(opts.footerText || '').trim();
  const footerHtml = String(opts.footerHtml || '').trim();
  const toEmail = String(opts.toEmail || '').trim();
  const lang = opts.lang === 'en' ? 'en' : 'cs';

  const ctaHref = String(opts.cta?.href || '').trim();
  const ctaLabel = String(opts.cta?.label || '').trim();
  const secondaryHref = String(opts.secondaryCta?.href || '').trim();
  const secondaryLabel = String(opts.secondaryCta?.label || '').trim();

  const ctaBlock = ctaHref && ctaLabel
    ? `<tr><td align="center" style="padding:18px 28px 8px 28px;">${bulletproofButton(ctaHref, ctaLabel)}</td></tr>
<tr><td align="center" style="padding:0 28px 18px 28px;font-family:Arial,sans-serif;font-size:12px;line-height:1.4;color:#78716c;word-break:break-all;">${escapeHtml(ctaHref)}</td></tr>`
    : '';

  const secondaryBlock = secondaryHref && secondaryLabel
    ? `<tr><td align="center" style="padding:0 28px 18px 28px;font-family:Arial,sans-serif;font-size:12px;line-height:1.4;">
<a href="${escapeHtml(secondaryHref)}" style="color:#16a34a;font-weight:900;text-decoration:underline;">${escapeHtml(secondaryLabel)}</a>
</td></tr>`
    : '';

  const footerLine = footerHtml
    ? footerHtml
    : footerText
      ? escapeHtml(footerText)
      : lang === 'en'
        ? 'Student club Pupen, z.s.'
        : 'Studentský spolek Pupen, z.s.';

  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-apple-disable-message-reformatting"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:#f5f5f4;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}</div><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f4;"><tr><td align="center" style="padding:24px 12px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:640px;max-width:640px;"><tr><td style="padding:0 0 14px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="left" style="font-family:Arial,sans-serif;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#dcfce7" style="padding:8px 12px;border-radius:999px;color:#166534;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;font-size:11px;">Pupen</td></tr></table></td><td align="right" style="font-family:Arial,sans-serif;font-size:12px;color:#78716c;"><a href="https://pupen.org" style="color:#16a34a;text-decoration:none;font-weight:800;">pupen.org</a></td></tr></table></td></tr><tr><td bgcolor="#ffffff" style="border:1px solid #e7e5e4;border-radius:24px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td bgcolor="#16a34a" style="height:6px;line-height:6px;font-size:6px;">&nbsp;</td></tr><tr><td style="padding:26px 28px 8px 28px;font-family:Arial,sans-serif;color:#1c1917;">${badge ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#f5f5f4" style="padding:6px 10px;border-radius:999px;border:1px solid #e7e5e4;color:#57534e;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;font-size:10px;">${escapeHtml(badge)}</td></tr></table>` : ''}<div style="height:${badge ? '10px' : '0'};line-height:${badge ? '10px' : '0'};font-size:${badge ? '10px' : '0'};">&nbsp;</div><div style="font-size:28px;line-height:1.15;font-weight:900;letter-spacing:-0.02em;">${escapeHtml(title)}</div></td></tr>${introHtml ? `<tr><td style="padding:10px 28px 0 28px;font-family:Arial,sans-serif;color:#292524;font-size:16px;line-height:1.6;">${introHtml}</td></tr>` : ''}${contentHtml ? `<tr><td style="padding:14px 28px 0 28px;font-family:Arial,sans-serif;color:#292524;font-size:15px;line-height:1.6;">${contentHtml}</td></tr>` : ''}${ctaBlock}${secondaryBlock}</table></td></tr><tr><td align="center" style="padding:16px 6px 0 6px;font-family:Arial,sans-serif;color:#78716c;font-size:12px;line-height:1.5;">${footerLine ? `<div style="margin-top:10px;">${footerLine}</div>` : ''}${toEmail ? `<div style="margin-top:8px;">${lang === 'en' ? 'This email was sent to' : 'Tento e‑mail byl odeslán na'} <span style="font-weight:800;color:#44403c;">${escapeHtml(toEmail)}</span>.</div>` : ''}</td></tr></table></td></tr></table></body></html>`;
}

export function renderEmailTemplate(key: EmailTemplateKey, vars: any): { subject: string; html: string; text?: string } {
  if (key === 'contact_message') {
    const name = String(vars?.name || '');
    const email = String(vars?.email || '');
    const subjectLine = String(vars?.subject || '').trim();
    const message = String(vars?.message || '');
    const createdAt = vars?.createdAt ? formatDateTimePrague(String(vars.createdAt), 'cs') : '';
    const messageId = String(vars?.messageId || '').trim();

    const subject = `Pupen — Nová zpráva z webu${subjectLine ? `: ${subjectLine}` : ''}`;
    const html = emailDoc({
      subject,
      title: 'Nová zpráva z webu',
      badge: 'Kontakt',
      preheader: subjectLine ? `Nová zpráva: ${subjectLine}` : 'Nová zpráva z webu.',
      introHtml: `<p style="margin:0;">Doručila se nová zpráva z webového formuláře.</p>`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          ${section('Jméno', name)}
          ${section('E‑mail', email)}
          ${subjectLine ? section('Předmět', subjectLine) : ''}
          ${createdAt ? section('Čas', createdAt) : ''}
          ${messageId ? section('ID', messageId) : ''}
          <hr style="border:none; border-top:1px solid #e7e5e4; margin:14px 0;" />
          <div style="font-weight:900; margin:0 0 8px 0;">Zpráva</div>
          <div style="background:#ffffff; border:1px solid #e7e5e4; border-radius:14px; padding:14px; white-space:pre-wrap;">${escapeHtml(message)}</div>
        </div>
        <div style="margin-top:12px; font-size:13px; color:#57534e; font-weight:800;">Odpověď pošlete na ${escapeHtml(email)}.</div>
      `,
    });
    return { subject, html };
  }

  if (key === 'newsletter') {
    const subjectLine = String(vars?.subject || '').trim();
    const content = String(vars?.html || '');
    const preheader = String(vars?.preheader || '').trim();
    const unsubLink = String(vars?.unsubLink || '').trim();
    const preferencesLink = String(vars?.preferencesLink || '').trim();
    const subject = subjectLine ? `Pupen — ${subjectLine}` : 'Pupen — Newsletter';
    const footerHtml = `<div style="margin-top:10px;">Studentský spolek Pupen, z.s.</div>${
      preferencesLink || unsubLink
        ? `<div style="margin-top:8px;">${
            preferencesLink
              ? `<a href="${escapeHtml(preferencesLink)}" style="color:#16a34a;font-weight:900;text-decoration:none;">Upravit odběr</a>`
              : ''
          }${preferencesLink && unsubLink ? `<span style="display:inline-block;width:12px;">&nbsp;</span>` : ''}${
            unsubLink ? `<a href="${escapeHtml(unsubLink)}" style="color:#78716c;font-weight:900;text-decoration:underline;">Zrušit odběr</a>` : ''
          }</div>`
        : ''
    }`;
    const html = emailDoc({
      subject,
      title: subjectLine || 'Newsletter',
      badge: 'Newsletter',
      preheader,
      contentHtml: content,
      footerHtml,
      lang: 'cs',
    });
    return { subject, html };
  }

  if (key === 'trust_box_verify') {
    const toEmail = String(vars?.toEmail || '').trim();
    const firstName = String(vars?.firstName || '').trim();
    const verifyUrl = String(vars?.verifyUrl || '').trim();
    const code = String(vars?.code || '').trim();
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const subject = lang === 'en' ? 'Pupen — Trust Box verification' : 'Pupen — Ověření schránky důvěry';
    const html = emailDoc({
      subject,
      title: lang === 'en' ? 'Verify your email' : 'Ověřte svůj e‑mail',
      badge: lang === 'en' ? 'Trust Box' : 'Schránka důvěry',
      preheader: lang === 'en' ? 'Verification code inside.' : 'Uvnitř je ověřovací kód.',
      introHtml: `<p style="margin:0;">${lang === 'en' ? 'To submit a message to the Trust Box, verify your email.' : 'Pro odeslání podnětu do schránky důvěry prosím ověřte svůj e‑mail.'}</p>`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          <div style="font-weight:900; font-size:13px; color:#44403c; margin-bottom:10px;">${lang === 'en' ? 'Hello' : 'Dobrý den'}${firstName ? ` ${escapeHtml(firstName)}` : ''}</div>
          ${code ? `<div style="margin:10px 0; font-weight:900;">${escapeHtml(lang === 'en' ? 'Code' : 'Kód')}:</div><div style="display:inline-block; background:#ffffff; border:1px solid #e7e5e4; border-radius:14px; padding:10px 12px; font-weight:950; letter-spacing:0.22em; font-size:18px;">${escapeHtml(code)}</div>` : ''}
        </div>
      `,
      cta: verifyUrl ? { href: verifyUrl, label: lang === 'en' ? 'Verify' : 'Ověřit' } : undefined,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'trust_box_confirm') {
    const toEmail = String(vars?.toEmail || '').trim();
    const firstName = String(vars?.firstName || '').trim();
    const threadUrl = String(vars?.threadUrl || '').trim();
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const subject = lang === 'en' ? 'Pupen — Trust Box received' : 'Pupen — Schránka důvěry: přijato';
    const html = emailDoc({
      subject,
      title: lang === 'en' ? 'Thank you' : 'Děkujeme za důvěru',
      badge: lang === 'en' ? 'Trust Box' : 'Schránka důvěry',
      preheader: lang === 'en' ? 'We received your report.' : 'Váš podnět byl přijat.',
      introHtml: `<p style="margin:0;">${lang === 'en' ? 'Hello' : 'Dobrý den'}${firstName ? ` ${escapeHtml(firstName)}` : ''}, ${lang === 'en' ? 'your message was received.' : 'váš podnět byl přijat.'}</p>`,
      cta: threadUrl ? { href: threadUrl, label: lang === 'en' ? 'Open thread' : 'Otevřít vlákno' } : undefined,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'trust_box_admin_reply') {
    const toEmail = String(vars?.toEmail || '').trim();
    const firstName = String(vars?.firstName || '').trim();
    const threadUrl = String(vars?.threadUrl || '').trim();
    const authorName = String(vars?.authorName || '').trim();
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const subject = lang === 'en' ? 'Pupen — Trust Box update' : 'Pupen — Schránka důvěry: nová zpráva';
    const html = emailDoc({
      subject,
      title: lang === 'en' ? 'New message' : 'Nová zpráva',
      badge: lang === 'en' ? 'Trust Box' : 'Schránka důvěry',
      preheader: lang === 'en' ? 'There is a new message in your thread.' : 'Ve vlákně je nová zpráva.',
      introHtml: `<p style="margin:0;">${lang === 'en' ? 'Hello' : 'Dobrý den'}${firstName ? ` ${escapeHtml(firstName)}` : ''}, ${lang === 'en' ? 'there is a new message in your Trust Box thread.' : 've vašem vlákně schránky důvěry je nová zpráva.'}</p>`,
      contentHtml: authorName
        ? `<div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:14px; font-weight:900; color:#57534e; font-size:13px;">${escapeHtml(lang === 'en' ? 'Replied by' : 'Odpověděl')}: ${escapeHtml(authorName)}</div>`
        : '',
      cta: threadUrl ? { href: threadUrl, label: lang === 'en' ? 'Open thread' : 'Otevřít vlákno' } : undefined,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'admin_password') {
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const password = String(vars?.password || '');
    const subject = 'Pupen — Přístup do administrace';
    const html = emailDoc({
      subject,
      title: 'Přístup do administrace',
      badge: 'Admin',
      preheader: 'V e‑mailu je dočasné heslo pro přihlášení.',
      introHtml: `<p style="margin:0;">Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}! Níže je dočasné heslo pro přístup do administrace.</p>`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px; text-align:center;">
          <div style="font-weight:900; margin-bottom:10px;">Dočasné heslo</div>
          <div style="display:inline-block; background:#ffffff; border:1px solid #e7e5e4; border-radius:14px; padding:10px 12px; font-weight:950; letter-spacing:0.18em; font-size:18px;">${escapeHtml(password)}</div>
          <div style="margin-top:12px; font-size:12px; color:#78716c; font-weight:800;">Heslo si po přihlášení změňte.</div>
        </div>
      `,
      footerText: 'Tento e‑mail byl odeslán automaticky systémem Pupen.',
      lang: 'cs',
    });
    return { subject, html };
  }

  if (key === 'password_reset') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const resetUrl = String(vars?.resetUrl || '');
    const subject = lang === 'en' ? 'Pupen — Password reset' : 'Pupen — Obnova hesla';
    const title = lang === 'en' ? 'Password reset' : 'Obnova hesla';
    const intro =
      lang === 'en'
        ? 'We received a request to reset your password.'
        : 'Obdrželi jsme žádost o obnovu vašeho hesla.';
    const cta = lang === 'en' ? 'Set a new password' : 'Nastavit nové heslo';
    const note =
      lang === 'en'
        ? 'If you did not request this, you can ignore this email.'
        : 'Pokud jste o obnovu nepožádali, tento e‑mail ignorujte.';
    const html = emailDoc({
      subject,
      title,
      badge: lang === 'en' ? 'Security' : 'Bezpečnost',
      preheader: lang === 'en' ? 'Use the link to set a new password.' : 'Odkaz pro nastavení nového hesla.',
      introHtml: `<p style="margin:0;">${escapeHtml(intro)}</p>`,
      cta: resetUrl ? { href: resetUrl, label: cta } : undefined,
      contentHtml: `<div style="margin-top:12px; font-size:12px; color:#78716c; font-weight:800;">${escapeHtml(note)}</div>`,
      lang,
    });
    return { subject, html };
  }

  if (key === 'member_access') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');
    const actionUrl = String(vars?.actionUrl || '');

    const subject = lang === 'en' ? 'Pupen — Access approved' : 'Pupen — Přístup schválen';
    const title = lang === 'en' ? 'Your access is approved' : 'Váš přístup je schválen';
    const intro =
      lang === 'en'
        ? `Hello${firstName ? ` ${escapeHtml(firstName)}` : ''}, your access to Pupen has been approved.`
        : `Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}, tvůj přístup do systému Pupen byl schválen.`;
    const cta = lang === 'en' ? 'Set password and sign in' : 'Nastavit heslo a přihlásit se';
    const note =
      lang === 'en'
        ? 'If you already have a password, you can still use this link to set a new one.'
        : 'Pokud už heslo máš, tímto odkazem si ho můžeš případně znovu nastavit.';

    const html = emailDoc({
      subject,
      title,
      badge: lang === 'en' ? 'Member' : 'Člen',
      preheader: lang === 'en' ? 'Your access is approved.' : 'Váš přístup je schválen.',
      introHtml: `<p style="margin:0;">${intro}</p>`,
      cta: actionUrl ? { href: actionUrl, label: cta } : undefined,
      contentHtml: `<div style="margin-top:12px; font-size:12px; color:#78716c; font-weight:800;">${escapeHtml(note)}</div>`,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'member_welcome') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');

    const subject = lang === 'en' ? 'Pupen — Welcome' : 'Pupen — Vítej';
    const title = lang === 'en' ? 'Welcome to Pupen' : 'Vítej v Pupen';
    const intro =
      lang === 'en'
        ? `Hello${firstName ? ` ${escapeHtml(firstName)}` : ''}! Your membership was approved.`
        : `Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}! Tvoje členství bylo schváleno.`;
    const body =
      lang === 'en'
        ? 'You can now access the member portal and stay updated.'
        : 'Můžeš teď využívat členský portál a mít přehled o dění.';

    const html = emailDoc({
      subject,
      title,
      badge: lang === 'en' ? 'Member' : 'Člen',
      preheader: lang === 'en' ? 'Welcome to Pupen.' : 'Vítej v Pupen.',
      introHtml: `<p style="margin:0;">${intro}</p>`,
      contentHtml: `<div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px; font-weight:800;">${escapeHtml(body)}</div>`,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'application_received') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');

    const subject = lang === 'en' ? 'Pupen — Application received' : 'Pupen — Přihláška přijata';
    const title = lang === 'en' ? 'We received your application' : 'Přihláška dorazila';
    const intro =
      lang === 'en'
        ? `Hello${firstName ? ` ${escapeHtml(firstName)}` : ''}, thank you! We received your application.`
        : `Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}, díky! Přihláška k nám dorazila.`;
    const body =
      lang === 'en'
        ? 'We will review it and then email you the result. After approval you will get access to the member portal.'
        : 'Přihlášku zkontrolujeme a výsledek pošleme e-mailem. Po schválení přijde i přístup do členského portálu.';

    const html = emailDoc({
      subject,
      title,
      badge: lang === 'en' ? 'Application' : 'Přihláška',
      preheader: lang === 'en' ? 'We received your application.' : 'Přihláška dorazila.',
      introHtml: `<p style="margin:0;">${intro}</p>`,
      contentHtml: `<div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px; font-weight:800;">${escapeHtml(body)}</div>`,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'application_new_admin') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const lastName = vars?.lastName ? String(vars.lastName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');
    const membershipType = String(vars?.membershipType || '');
    const adminLink = String(vars?.adminLink || '');

    const subject = lang === 'en' ? 'Pupen Control — New application' : 'Pupen Control — Nová přihláška';
    const title = lang === 'en' ? 'New application submitted' : 'Byla podána nová přihláška';
    const fullName = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();

    const html = emailDoc({
      subject,
      title,
      badge: 'Admin',
      preheader: lang === 'en' ? 'A new application was submitted.' : 'Byla podána nová přihláška.',
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          ${fullName ? section(lang === 'en' ? 'Name' : 'Jméno', fullName) : ''}
          ${toEmail ? section('E-mail', toEmail) : ''}
          ${membershipType ? section(lang === 'en' ? 'Type' : 'Typ', membershipType) : ''}
        </div>
      `,
      cta: adminLink ? { href: adminLink, label: lang === 'en' ? 'Open in admin' : 'Otevřít v administraci' } : undefined,
      lang,
    });
    return { subject, html };
  }

  if (key === 'application_approved_access') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');
    const actionUrl = String(vars?.actionUrl || '');
    const pdfUrl = String(vars?.pdfUrl || '');

    const subject = lang === 'en' ? 'Pupen — Application approved' : 'Pupen — Přihláška schválena';
    const title = lang === 'en' ? 'Welcome to Pupen' : 'Vítej v Pupen';
    const intro =
      lang === 'en'
        ? `Hello${firstName ? ` ${escapeHtml(firstName)}` : ''}, your application was approved.`
        : `Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}, tvoje přihláška byla schválena.`;
    const cta = lang === 'en' ? 'Set password and sign in' : 'Nastavit heslo a přihlásit se';
    const pdfLabel = lang === 'en' ? 'Download application PDF' : 'Stáhnout PDF přihlášky';

    const html = emailDoc({
      subject,
      title,
      badge: lang === 'en' ? 'Application' : 'Přihláška',
      preheader: lang === 'en' ? 'Application approved.' : 'Přihláška schválena.',
      introHtml: `<p style="margin:0;">${intro}</p>`,
      cta: actionUrl ? { href: actionUrl, label: cta } : undefined,
      secondaryCta: pdfUrl ? { href: pdfUrl, label: pdfLabel } : undefined,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'application_status') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');
    const status = String(vars?.status || 'pending').trim();
    const reason = String(vars?.reason || '').trim();

    const statusLabel =
      status === 'approved'
        ? lang === 'en'
          ? 'Approved'
          : 'Schváleno'
        : status === 'rejected'
          ? lang === 'en'
            ? 'Rejected'
            : 'Odmítnuto'
          : lang === 'en'
            ? 'Pending'
            : 'Čeká';

    const subject =
      status === 'approved'
        ? lang === 'en'
          ? 'Pupen — Application approved'
          : 'Pupen — Přihláška schválena'
        : status === 'rejected'
          ? lang === 'en'
            ? 'Pupen — Application rejected'
            : 'Pupen — Přihláška zamítnuta'
          : lang === 'en'
            ? 'Pupen — Application update'
            : 'Pupen — Změna stavu přihlášky';

    const title = lang === 'en' ? 'Application status update' : 'Změna stavu přihlášky';
    const intro =
      lang === 'en'
        ? `Hello${firstName ? ` ${escapeHtml(firstName)}` : ''}, the status of your application has changed.`
        : `Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}, změnil se stav tvé přihlášky.`;
    const hint =
      status === 'approved'
        ? lang === 'en'
          ? 'You will receive access instructions separately.'
          : 'Pokyny k přístupu přijdou v samostatném e-mailu.'
        : status === 'rejected'
          ? lang === 'en'
            ? 'If you have questions, reply to this email.'
            : 'Pokud máte dotazy, odpovězte na tento e-mail.'
          : lang === 'en'
            ? 'We will contact you after review.'
            : 'Po posouzení vás budeme kontaktovat.';

    const html = emailDoc({
      subject,
      title,
      badge: lang === 'en' ? 'Application' : 'Přihláška',
      preheader: `${lang === 'en' ? 'Status' : 'Stav'}: ${statusLabel}`,
      introHtml: `<p style="margin:0;">${intro}</p>`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          <div style="font-weight:950; font-size:16px;">${escapeHtml(lang === 'en' ? 'Status' : 'Stav')}: ${escapeHtml(statusLabel)}</div>
          ${reason ? `<div style="margin-top:10px; font-weight:800; color:#44403c;">${escapeHtml(lang === 'en' ? 'Reason' : 'Důvod')}: ${escapeHtml(reason)}</div>` : ''}
          <div style="margin-top:12px; font-size:12px; color:#78716c; font-weight:800;">${escapeHtml(hint)}</div>
        </div>
      `,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'application_status_admin') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const lastName = vars?.lastName ? String(vars.lastName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');
    const status = String(vars?.status || 'pending').trim();
    const reason = String(vars?.reason || '').trim();
    const adminLink = String(vars?.adminLink || '').trim();

    const statusLabel =
      status === 'approved'
        ? lang === 'en'
          ? 'Approved'
          : 'Schváleno'
        : status === 'rejected'
          ? lang === 'en'
            ? 'Rejected'
            : 'Zamítnuto'
          : lang === 'en'
            ? 'Pending'
            : 'Čeká';

    const subject = lang === 'en' ? 'Pupen Control — Application status changed' : 'Pupen Control — Změna stavu přihlášky';
    const title = lang === 'en' ? 'Application status changed' : 'Změna stavu přihlášky';
    const fullName = `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim();

    const html = emailDoc({
      subject,
      title,
      badge: 'Admin',
      preheader: `${lang === 'en' ? 'Status' : 'Stav'}: ${statusLabel}`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          ${fullName ? section(lang === 'en' ? 'Name' : 'Jméno', fullName) : ''}
          ${toEmail ? section('E-mail', toEmail) : ''}
          ${section(lang === 'en' ? 'Status' : 'Stav', statusLabel)}
          ${reason ? section(lang === 'en' ? 'Reason' : 'Důvod', reason) : ''}
        </div>
      `,
      cta: adminLink ? { href: adminLink, label: lang === 'en' ? 'Open in admin' : 'Otevřít v administraci' } : undefined,
      lang,
    });
    return { subject, html };
  }

  if (key === 'membership_expiry') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');
    const daysLeft = typeof vars?.daysLeft === 'number' ? vars.daysLeft : Number(vars?.daysLeft || 0);
    const dateStr = vars?.expiresAt ? formatDatePrague(String(vars.expiresAt), lang) : '';

    const isExpired = daysLeft < 0;
    const subject = isExpired
      ? lang === 'en'
        ? 'Pupen — Membership expired'
        : 'Pupen — Členství vypršelo'
      : lang === 'en'
        ? 'Pupen — Membership expires soon'
        : 'Pupen — Členství brzy vyprší';
    const title = isExpired ? (lang === 'en' ? 'Membership expired' : 'Členství vypršelo') : (lang === 'en' ? 'Membership expires soon' : 'Členství brzy vyprší');
    const intro = isExpired
      ? lang === 'en'
        ? `Hello${firstName ? ` ${escapeHtml(firstName)}` : ''}, your membership has expired.`
        : `Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}, tvoje členství vypršelo.`
      : lang === 'en'
        ? `Hello${firstName ? ` ${escapeHtml(firstName)}` : ''}, your membership will expire soon.`
        : `Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}, tvoje členství brzy vyprší.`;
    const body = dateStr
      ? isExpired
        ? lang === 'en'
          ? `Expiration date: ${escapeHtml(dateStr)}`
          : `Datum expirace: ${escapeHtml(dateStr)}`
        : lang === 'en'
          ? `Expiration date: ${escapeHtml(dateStr)}`
          : `Datum expirace: ${escapeHtml(dateStr)}`
      : '';
    const hint =
      lang === 'en'
        ? 'If you have questions about renewal, reply to this email.'
        : 'Pokud máte dotazy k prodloužení, odpovězte na tento e-mail.';

    const html = emailDoc({
      subject,
      title,
      badge: lang === 'en' ? 'Membership' : 'Členství',
      preheader: isExpired ? (lang === 'en' ? 'Membership expired.' : 'Členství vypršelo.') : (lang === 'en' ? 'Membership expires soon.' : 'Členství brzy vyprší.'),
      introHtml: `<p style="margin:0;">${intro}</p>`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          ${body ? `<div style="font-weight:900;">${body}</div>` : ''}
          ${daysLeft >= 0 ? `<div style="margin-top:10px; font-size:12px; color:#78716c; font-weight:900;">${escapeHtml(lang === 'en' ? `Days left: ${Math.ceil(daysLeft)}` : `Zbývá dní: ${Math.ceil(daysLeft)}`)}</div>` : ''}
          <div style="margin-top:12px; font-size:12px; color:#78716c; font-weight:800;">${escapeHtml(hint)}</div>
        </div>
      `,
      toEmail,
      lang,
    });
    return { subject, html };
  }

  if (key === 'invoice_request') {
    const rsvpId = String(vars?.rsvpId || '');
    const eventTitle = String(vars?.eventTitle || '');
    const buyerType = vars?.buyerType === 'company' ? 'Firma' : 'Osoba';
    const subject = `Žádost o fakturu: ${eventTitle} (${rsvpId})`;
    const html = emailDoc({
      subject,
      title: 'Žádost o fakturu',
      badge: 'Finance',
      preheader: `Žádost o fakturu: ${eventTitle}`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          <div style="font-weight:950; font-size:16px; margin-bottom:10px;">${escapeHtml(eventTitle)}</div>
          ${section('RSVP ID', rsvpId)}
          ${vars?.eventId ? section('Event ID', vars.eventId) : ''}
          ${section('Kontakt', vars?.email)}
          <hr style="border:none; border-top:1px solid #e7e5e4; margin:14px 0;" />
          ${section('Typ odběratele', buyerType)}
          ${section('Název / jméno', vars?.buyerName)}
          ${section('Adresa', vars?.buyerAddress)}
          ${vars?.buyerType === 'company' ? `${section('IČO', vars?.ico || '-')}${section('DIČ', vars?.dic || '-')}` : ''}
          ${vars?.note ? `<hr style="border:none; border-top:1px solid #e7e5e4; margin:14px 0;" />${section('Poznámka', vars?.note)}` : ''}
        </div>
      `,
      footerText: 'Tento e‑mail byl odeslán automaticky systémem Pupen.',
      lang: 'cs',
    });
    return { subject, html };
  }

  if (key === 'refund_request') {
    const rsvpId = String(vars?.rsvpId || '');
    const eventTitle = String(vars?.eventTitle || '');
    const reason = String(vars?.reason || '');
    const subject = `Žádost o refund: ${eventTitle} (${rsvpId})`;
    const html = emailDoc({
      subject,
      title: 'Žádost o refund',
      badge: 'Finance',
      preheader: `Žádost o refund: ${eventTitle}`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          <div style="font-weight:950; font-size:16px; margin-bottom:10px;">${escapeHtml(eventTitle)}</div>
          ${section('RSVP ID', rsvpId)}
          ${vars?.eventId ? section('Event ID', vars.eventId) : ''}
          ${section('Kontakt', vars?.email)}
          <hr style="border:none; border-top:1px solid #e7e5e4; margin:14px 0;" />
          ${section('Důvod', reason)}
          ${vars?.note ? `<hr style="border:none; border-top:1px solid #e7e5e4; margin:14px 0;" />${section('Poznámka', vars?.note)}` : ''}
        </div>
      `,
      footerText: 'Tento e‑mail byl odeslán automaticky systémem Pupen.',
      lang: 'cs',
    });
    return { subject, html };
  }

  if (key === 'refund_status') {
    const refundLogId = String(vars?.refundLogId || '');
    const rsvpId = String(vars?.rsvpId || '');
    const eventTitle = String(vars?.eventTitle || '');
    const status = String(vars?.status || '');
    const amount = vars?.amount != null && vars?.amount !== '' ? String(vars.amount) : '';
    const currency = String(vars?.currency || 'CZK');
    const note = vars?.note ? String(vars.note) : '';

    const statusLabel =
      status === 'approved' ? 'Schváleno' : status === 'denied' ? 'Zamítnuto' : status === 'paid' ? 'Vyplaceno' : status;

    const subject = `Refund – ${statusLabel}: ${eventTitle}`;
    const html = emailDoc({
      subject,
      title: 'Refund – změna stavu',
      badge: 'Finance',
      preheader: `${statusLabel}: ${eventTitle}`,
      contentHtml: `
        <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
          <div style="font-weight:950; font-size:16px; margin-bottom:10px;">${escapeHtml(eventTitle)}</div>
          ${refundLogId ? section('Žádost ID', refundLogId) : ''}
          ${rsvpId ? section('RSVP ID', rsvpId) : ''}
          ${vars?.eventId ? section('Event ID', vars.eventId) : ''}
          <hr style="border:none; border-top:1px solid #e7e5e4; margin:14px 0;" />
          ${section('Stav', statusLabel)}
          ${amount ? section('Částka', `${amount} ${currency}`) : ''}
          ${note ? `<hr style="border:none; border-top:1px solid #e7e5e4; margin:14px 0;" />${section('Poznámka', note)}` : ''}
        </div>
      `,
      footerText: 'Tento e‑mail byl odeslán automaticky systémem Pupen.',
      lang: 'cs',
    });
    return { subject, html };
  }

  const email = String(vars?.email || '');
  const name = String(vars?.name || email);
  const eventTitle = String(vars?.eventTitle || '');
  const paymentMethod = String(vars?.paymentMethod || 'hotove');
  const qrToken = String(vars?.qrToken || '');
  const status = String(vars?.status || 'confirmed');
  const bankAccount = String(vars?.bankAccount || '');

  const isWaitlist = status === 'waitlist';
  const isPrevod = paymentMethod === 'prevod';

  const subject = isWaitlist ? `Pupen — Čekací listina: ${eventTitle}` : `Pupen — Vstupenka: ${eventTitle}`;
  const attendees = Array.isArray(vars?.attendees) ? vars.attendees : [];

  const attendeeList = attendees
    .map((a: any) => `<li style="margin: 4px 0;">${escapeHtml(a?.name || '')}</li>`)
    .join('');

  const html = emailDoc({
    subject,
    title: eventTitle || 'Vstupenka',
    badge: isWaitlist ? 'Waitlist' : 'Vstupenka',
    preheader: isWaitlist ? `Čekací listina: ${eventTitle}` : `Vstupenka: ${eventTitle}`,
    introHtml: `<p style="margin:0;">${escapeHtml(name)}</p>`,
    contentHtml: `
      <div style="background:#f5f5f4; border:1px solid #e7e5e4; border-radius:18px; padding:16px;">
        <div style="font-weight:900;">Status: ${escapeHtml(status)}</div>
        ${attendeeList ? `<div style="margin-top:12px; font-weight:900;">Účastníci:</div><ul style="padding-left:18px; margin:8px 0 0 0;">${attendeeList}</ul>` : ''}
        <hr style="border:none; border-top:1px solid #e7e5e4; margin:14px 0;" />
        <div style="font-weight:900; margin-bottom:8px;">QR Token</div>
        <div style="display:inline-block; background:#ffffff; border:1px solid #e7e5e4; border-radius:14px; padding:10px 12px; font-weight:950; letter-spacing:0.22em; font-size:18px;">${escapeHtml(qrToken)}</div>
        <div style="margin-top:10px; font-size:12px; color:#78716c; font-weight:800;">Při vstupu ukažte QR token (nebo QR kód v portálu).</div>
      </div>
      ${
        isPrevod && !isWaitlist
          ? `<div style="margin-top:14px; border:2px dashed #16a34a; border-radius:18px; padding:16px; text-align:center;">
              <div style="font-weight:950; font-size:16px;">Platební údaje</div>
              <div style="margin-top:8px; font-weight:800;">Prosíme o úhradu do 24 hodin, jinak bude rezervace zrušena.</div>
              <div style="margin-top:10px; font-size:12px; color:#78716c; font-weight:900;">Účet: ${escapeHtml(bankAccount || '—')}</div>
              <div style="margin-top:10px;">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`SPD:1.0*ACC:${bankAccount}*AM:100.00*CC:CZK*MSG:Pupen ${qrToken}`)}" alt="QR Platba" style="margin:0; border-radius:14px;" />
              </div>
            </div>`
          : ''
      }
    `,
    footerText: 'Tento e‑mail byl odeslán automaticky systémem Pupen.',
    lang: 'cs',
  });

  return { subject, html };
}
