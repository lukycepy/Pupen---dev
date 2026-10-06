import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { requireAdmin } from '@/lib/server-auth';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { buildEventCalendarAttachment } from '@/lib/tickets/calendarInvite';
import { ensureGuardianConsentPdf, getMinorAttendees } from '@/lib/rsvp/guardianConsent';
import { buildTicketPdfAttachment, buildTicketPdfUrl } from '@/lib/tickets/pdf';

interface SendTicketBody {
  email?: unknown;
  name?: unknown;
  eventTitle?: unknown;
  eventId?: unknown;
  attendees?: unknown;
  paymentMethod?: unknown;
  qrToken?: unknown;
  status?: unknown;
  vs?: unknown;
  dueDate?: unknown;
  priceTotal?: unknown;
  pricingLabel?: unknown;
  pricingLabelEn?: unknown;
  lang?: unknown;
}

interface PaymentSettingsRow {
  bank_account?: string | null;
}

interface EventRow {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
  date?: string | null;
  location?: string | null;
}

interface RsvpGuardianRow {
  id?: string | null;
  event_id?: string | null;
  name?: string | null;
  email?: string | null;
  attendees?: unknown;
  qr_token?: string | null;
  qr_code?: string | null;
  guardian_consent_document_bucket?: string | null;
  guardian_consent_document_path?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    const body = toRecord(await req.json().catch(() => ({}))) as SendTicketBody;
    const email = String(body.email || '').trim().toLowerCase().slice(0, 240);
    const name = String(body.name || '').trim().slice(0, 160);
    const eventTitle = String(body.eventTitle || '').trim().slice(0, 240);
    const eventId = String(body.eventId || '').trim().slice(0, 80);
    const attendees = body.attendees;
    const paymentMethod = String(body.paymentMethod || '').trim().slice(0, 80);
    const qrToken = String(body.qrToken || '').trim().slice(0, 500);
    const status = String(body.status || '').trim().slice(0, 80);
    const vs = String(body.vs || '').trim().slice(0, 40);
    const dueDate = String(body.dueDate || '').trim().slice(0, 80);
    const priceTotal = Number(body.priceTotal ?? 0);
    const pricingLabel = String(body.pricingLabel || '').trim().slice(0, 120);
    const pricingLabelEn = String(body.pricingLabelEn || '').trim().slice(0, 120);
    const lang = body.lang === 'en' ? 'en' : 'cs';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Neplatný e-mail.' }, { status: 400 });
    }

    let bankAccount = process.env.BANK_ACCOUNT || 'CZ1234567890';
    let guardianConsentAttachment: any = null;
    let guardianConsentUrl = '';
    let guardianConsentUploadUrl = '';
    let ticketPdfAttachment: any = null;
    try {
      const supabase = getServerSupabase();
      const { data } = await supabase.from('payment_settings').select('bank_account').single();
      const paymentSettings = (data || null) as PaymentSettingsRow | null;
      if (paymentSettings?.bank_account) bankAccount = String(paymentSettings.bank_account);

      if (eventId && qrToken) {
        const eventRes = await supabase.from('events').select('id, title, title_en, date, location').eq('id', eventId).maybeSingle();
        const rsvpRes = await supabase
          .from('rsvp')
          .select('id, event_id, name, email, attendees, qr_token, qr_code, guardian_consent_document_bucket, guardian_consent_document_path')
          .or(`qr_token.eq.${qrToken},qr_code.eq.${qrToken}`)
          .maybeSingle();
        const event = (eventRes.data || null) as EventRow | null;
        const rsvp = (rsvpRes.data || null) as RsvpGuardianRow | null;
        if (event?.id && rsvp?.id) {
          const minors = getMinorAttendees(rsvp.attendees, event.date);
          const guardianConsent = await ensureGuardianConsentPdf({ event, rsvp, minors, lang });
          guardianConsentAttachment = guardianConsent.attachment;
          guardianConsentUrl = guardianConsent.downloadUrl;
          guardianConsentUploadUrl = guardianConsent.uploadUrl;
          ticketPdfAttachment = await buildTicketPdfAttachment({
            event,
            rsvp: {
              ...rsvp,
              status,
              expires_at: dueDate || null,
              payment_method: paymentMethod,
              variable_symbol: vs,
              price_total: priceTotal,
              pricing_label: pricingLabel,
              pricing_label_en: pricingLabelEn,
            },
            lang,
          });
        }
      }
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
      vs,
      dueDate,
      priceTotal,
      pricingLabel,
      pricingLabelEn,
      ticketPdfUrl: qrToken ? buildTicketPdfUrl(qrToken, lang) : '',
      guardianConsentUrl,
      guardianConsentUploadUrl,
      lang,
    });
    const calendarAttachment = eventId ? await buildEventCalendarAttachment(eventId, lang) : null;

    await sendMailWithQueueFallback({
      transporter,
      supabase: getServerSupabase(),
      meta: { kind: 'ticket' },
      message: {
        from,
        to: email,
        subject,
        html,
        text: stripHtmlToText(html),
        attachments: [calendarAttachment, ticketPdfAttachment, guardianConsentAttachment].filter(Boolean) as any,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
