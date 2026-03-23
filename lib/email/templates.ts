export type EmailTemplateKey = 'ticket' | 'admin_password' | 'password_reset' | 'member_access' | 'invoice_request' | 'refund_request' | 'refund_status';

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
