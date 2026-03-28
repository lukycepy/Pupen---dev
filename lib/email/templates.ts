export type EmailTemplateKey =
  | 'ticket'
  | 'admin_password'
  | 'password_reset'
  | 'member_access'
  | 'member_welcome'
  | 'membership_expiry'
  | 'application_status'
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

export function renderEmailTemplate(key: EmailTemplateKey, vars: any): { subject: string; html: string; text?: string } {
  if (key === 'contact_message') {
    const name = String(vars?.name || '');
    const email = String(vars?.email || '');
    const subjectLine = String(vars?.subject || '').trim();
    const message = String(vars?.message || '');
    const createdAt = vars?.createdAt ? new Date(String(vars.createdAt)).toLocaleString('cs-CZ') : '';
    const messageId = String(vars?.messageId || '').trim();

    const subject = `Pupen — Nová zpráva z webu${subjectLine ? `: ${subjectLine}` : ''}`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">Nová zpráva z webu</h2>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0;">
          ${section('Jméno', name)}
          ${section('E‑mail', email)}
          ${subjectLine ? section('Předmět', subjectLine) : ''}
          ${createdAt ? section('Čas', createdAt) : ''}
          ${messageId ? section('ID', messageId) : ''}
          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" />
          <p style="margin: 8px 0;"><strong>Zpráva:</strong></p>
          <div style="background: #ffffff; border: 1px solid #e7e5e4; border-radius: 14px; padding: 14px; white-space: pre-wrap;">${escapeHtml(message)}</div>
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">Odpověď pošlete na ${escapeHtml(email)}.</p>
      </div>
    `;
    return { subject, html };
  }

  if (key === 'newsletter') {
    const subjectLine = String(vars?.subject || '').trim();
    const content = String(vars?.html || '');
    const preheader = String(vars?.preheader || '').trim();
    const unsubLink = String(vars?.unsubLink || '').trim();
    const preferencesLink = String(vars?.preferencesLink || '').trim();
    const subject = subjectLine ? `Pupen — ${subjectLine}` : 'Pupen — Newsletter';
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0; padding:0; background:#f5f5f4;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent; mso-hide:all;">
      ${escapeHtml(preheader)}
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f4;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:640px; max-width:640px;">
            <tr>
              <td style="padding:0 0 14px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td align="left" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
                      <div style="display:inline-block; padding:8px 12px; border-radius:999px; background:#dcfce7; color:#166534; font-weight:900; letter-spacing:0.18em; text-transform:uppercase; font-size:11px;">
                        Pupen
                      </div>
                    </td>
                    <td align="right" style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size:12px; color:#78716c;">
                      <a href="https://pupen.org" style="color:#16a34a; text-decoration:none; font-weight:800;">pupen.org</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="background:#ffffff; border:1px solid #e7e5e4; border-radius:24px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.06);">
                <div style="height:8px; background:linear-gradient(90deg, #16a34a, #22c55e);"></div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:28px 28px 10px 28px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#1c1917;">
                      ${subjectLine ? `<h1 style="margin:0; font-size:28px; line-height:1.15; font-weight:900; letter-spacing:-0.02em;">${escapeHtml(subjectLine)}</h1>` : ''}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 28px 26px 28px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#292524; font-size:16px; line-height:1.6;">
                      ${content}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:16px 6px 0 6px; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; color:#78716c; font-size:12px; line-height:1.5; text-align:center;">
                <div style="margin-top:10px;">Studentský spolek Pupen, z.s.</div>
                <div style="margin-top:8px;">
                  ${preferencesLink ? `<a href="${escapeHtml(preferencesLink)}" style="color:#16a34a; font-weight:800; text-decoration:none;">Upravit odběr</a>` : ''}
                  ${preferencesLink && unsubLink ? `<span style="display:inline-block; width:12px;"></span>` : ''}
                  ${unsubLink ? `<a href="${escapeHtml(unsubLink)}" style="color:#78716c; font-weight:800; text-decoration:underline;">Zrušit odběr</a>` : ''}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    return { subject, html };
  }

  if (key === 'admin_password') {
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const password = String(vars?.password || '');
    const subject = 'Pupen — Přístup do administrace';
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">Přístup do administrace</h2>
        <p style="text-align: center; font-weight: bold; font-size: 18px;">Ahoj${firstName ? ` ${escapeHtml(firstName)}` : ''}!</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0;">
          <p><strong>Vaše nové heslo:</strong></p>
          <p style="font-size: 22px; font-weight: 800; letter-spacing: 0.2em; background: white; padding: 12px 16px; border-radius: 12px; display: inline-block;">${escapeHtml(password)}</p>
          <p style="font-size: 12px; color: #78716c; margin-top: 16px;">Heslo si po přihlášení změňte.</p>
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">Tento e-mail byl odeslán automaticky systémem Pupen.</p>
      </div>
    `;
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
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">${escapeHtml(title)}</h2>
        <p style="text-align: center; font-weight: 700; font-size: 16px;">${escapeHtml(intro)}</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0; text-align: center;">
          <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background: #16a34a; color: #fff; padding: 14px 18px; border-radius: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; font-size: 12px;">
            ${escapeHtml(cta)}
          </a>
          <p style="margin-top: 16px; font-size: 12px; color: #78716c;">${escapeHtml(resetUrl)}</p>
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">${escapeHtml(note)}</p>
      </div>
    `;
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

    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">${escapeHtml(title)}</h2>
        <p style="text-align: center; font-weight: 700; font-size: 16px;">${intro}</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0; text-align: center;">
          <a href="${escapeHtml(actionUrl)}" style="display: inline-block; background: #16a34a; color: #fff; padding: 14px 18px; border-radius: 14px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none; font-size: 12px;">
            ${escapeHtml(cta)}
          </a>
          <p style="margin-top: 16px; font-size: 12px; color: #78716c;">${escapeHtml(actionUrl)}</p>
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">${escapeHtml(note)}</p>
        ${toEmail ? `<p style="font-size: 12px; color: #78716c; text-align: center;">${escapeHtml(toEmail)}</p>` : ''}
      </div>
    `;
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

    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">${escapeHtml(title)}</h2>
        <p style="text-align: center; font-weight: 700; font-size: 16px;">${intro}</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #292524; font-weight: 700;">${escapeHtml(body)}</p>
        </div>
        ${toEmail ? `<p style="font-size: 12px; color: #78716c; text-align: center;">${escapeHtml(toEmail)}</p>` : ''}
      </div>
    `;
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

    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">${escapeHtml(title)}</h2>
        <p style="text-align: center; font-weight: 700; font-size: 16px;">${intro}</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #292524; font-weight: 800;">${escapeHtml(lang === 'en' ? 'Status' : 'Stav')}: ${escapeHtml(statusLabel)}</p>
          ${reason ? `<p style="margin: 10px 0 0; font-size: 13px; color: #44403c; font-weight: 700;">${escapeHtml(lang === 'en' ? 'Reason' : 'Důvod')}: ${escapeHtml(reason)}</p>` : ''}
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">${escapeHtml(hint)}</p>
        ${toEmail ? `<p style="font-size: 12px; color: #78716c; text-align: center;">${escapeHtml(toEmail)}</p>` : ''}
      </div>
    `;
    return { subject, html };
  }

  if (key === 'membership_expiry') {
    const lang = vars?.lang === 'en' ? 'en' : 'cs';
    const firstName = vars?.firstName ? String(vars.firstName) : '';
    const toEmail = String(vars?.toEmail || vars?.email || '');
    const daysLeft = typeof vars?.daysLeft === 'number' ? vars.daysLeft : Number(vars?.daysLeft || 0);
    const expiresAt = vars?.expiresAt ? new Date(String(vars.expiresAt)) : null;
    const dateStr = expiresAt ? expiresAt.toLocaleDateString(lang === 'en' ? 'en-US' : 'cs-CZ') : '';

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

    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">${escapeHtml(title)}</h2>
        <p style="text-align: center; font-weight: 700; font-size: 16px;">${intro}</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0; text-align: center;">
          ${body ? `<p style="margin: 0; font-size: 14px; color: #292524; font-weight: 700;">${body}</p>` : ''}
          ${daysLeft >= 0 ? `<p style="margin: 10px 0 0; font-size: 12px; color: #78716c;">${escapeHtml(lang === 'en' ? `Days left: ${Math.ceil(daysLeft)}` : `Zbývá dní: ${Math.ceil(daysLeft)}`)}</p>` : ''}
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">${escapeHtml(hint)}</p>
        ${toEmail ? `<p style="font-size: 12px; color: #78716c; text-align: center;">${escapeHtml(toEmail)}</p>` : ''}
      </div>
    `;
    return { subject, html };
  }

  if (key === 'invoice_request') {
    const rsvpId = String(vars?.rsvpId || '');
    const eventTitle = String(vars?.eventTitle || '');
    const buyerType = vars?.buyerType === 'company' ? 'Firma' : 'Osoba';
    const subject = `Žádost o fakturu: ${eventTitle} (${rsvpId})`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">Žádost o fakturu</h2>
        <p style="text-align: center; font-weight: bold; font-size: 18px;">${escapeHtml(eventTitle)}</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0;">
          ${section('RSVP ID', rsvpId)}
          ${vars?.eventId ? section('Event ID', vars.eventId) : ''}
          ${section('Kontakt', vars?.email)}
          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" />
          ${section('Typ odběratele', buyerType)}
          ${section('Název / jméno', vars?.buyerName)}
          ${section('Adresa', vars?.buyerAddress)}
          ${vars?.buyerType === 'company' ? `${section('IČO', vars?.ico || '-')}${section('DIČ', vars?.dic || '-')}` : ''}
          ${vars?.note ? `<hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" />${section('Poznámka', vars?.note)}` : ''}
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">Tento e-mail byl odeslán automaticky systémem Pupen.</p>
      </div>
    `;
    return { subject, html };
  }

  if (key === 'refund_request') {
    const rsvpId = String(vars?.rsvpId || '');
    const eventTitle = String(vars?.eventTitle || '');
    const reason = String(vars?.reason || '');
    const subject = `Žádost o refund: ${eventTitle} (${rsvpId})`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">Žádost o refund</h2>
        <p style="text-align: center; font-weight: bold; font-size: 18px;">${escapeHtml(eventTitle)}</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0;">
          ${section('RSVP ID', rsvpId)}
          ${vars?.eventId ? section('Event ID', vars.eventId) : ''}
          ${section('Kontakt', vars?.email)}
          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" />
          ${section('Důvod', reason)}
          ${vars?.note ? `<hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" />${section('Poznámka', vars?.note)}` : ''}
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">Tento e-mail byl odeslán automaticky systémem Pupen.</p>
      </div>
    `;
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
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">Refund – změna stavu</h2>
        <p style="text-align: center; font-weight: bold; font-size: 18px;">${escapeHtml(eventTitle)}</p>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0;">
          ${refundLogId ? section('Žádost ID', refundLogId) : ''}
          ${rsvpId ? section('RSVP ID', rsvpId) : ''}
          ${vars?.eventId ? section('Event ID', vars.eventId) : ''}
          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" />
          ${section('Stav', statusLabel)}
          ${amount ? section('Částka', `${amount} ${currency}`) : ''}
          ${note ? `<hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" />${section('Poznámka', note)}` : ''}
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">Tento e-mail byl odeslán automaticky systémem Pupen.</p>
      </div>
    `;
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

  const html = `
    <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
      <h2 style="color: #16a34a; text-align: center;">${escapeHtml(eventTitle)}</h2>
      <p style="text-align: center; font-weight: bold; font-size: 18px;">${escapeHtml(name)}</p>
      <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0;">
        <p style="margin-top: 0;"><strong>Status:</strong> ${escapeHtml(status)}</p>
        ${attendeeList ? `<p><strong>Účastníci:</strong></p><ul style="padding-left: 18px; margin-top: 8px;">${attendeeList}</ul>` : ''}
        <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" />
        <p><strong>QR Token:</strong></p>
        <p style="font-size: 22px; font-weight: 800; letter-spacing: 0.2em; background: white; padding: 12px 16px; border-radius: 12px; display: inline-block;">${escapeHtml(qrToken)}</p>
        <p style="font-size: 12px; color: #78716c; margin-top: 12px;">Při vstupu ukažte QR token (nebo QR kód v portálu).</p>
      </div>
      ${
        isPrevod && !isWaitlist
          ? `
        <div style="border: 2px dashed #16a34a; padding: 20px; border-radius: 15px; text-align: center; margin: 20px 0;">
          <h3 style="margin-top: 0;">Platební údaje</h3>
          <p>Prosíme o úhradu do 24 hodin, jinak bude rezervace zrušena.</p>
          <p style="font-size: 12px; color: #78716c;">Účet: ${escapeHtml(bankAccount || '—')}</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
            `SPD:1.0*ACC:${bankAccount}*AM:100.00*CC:CZK*MSG:Pupen ${qrToken}`
          )}" alt="QR Platba" style="margin: 10px 0;" />
        </div>
      `
          : ''
      }
      <p style="font-size: 12px; color: #78716c; text-align: center;">Tento e-mail byl odeslán automaticky systémem Pupen.</p>
    </div>
  `;

  return { subject, html };
}
