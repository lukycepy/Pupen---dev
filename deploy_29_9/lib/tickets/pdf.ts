import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import type { Attachment } from 'nodemailer/lib/mailer';
import QRCode from 'qrcode';
import { getPdfFonts } from '@/lib/pdf/fonts';
import { getPublicBaseUrl } from '@/lib/public-base-url';

type TicketPdfEvent = {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
  date?: string | null;
  end_date?: string | null;
  location?: string | null;
  location_en?: string | null;
};

type TicketPdfRsvp = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  attendees?: unknown;
  qr_token?: string | null;
  qr_code?: string | null;
  status?: string | null;
  expires_at?: string | null;
  payment_method?: string | null;
  variable_symbol?: string | null;
  price_total?: number | null;
  pricing_label?: string | null;
  pricing_label_en?: string | null;
  checked_in?: boolean | null;
  checked_in_at?: string | null;
};

function cleanText(input: unknown, fallback = '') {
  const s = String(input ?? '').replace(/\u0000/g, '').trim();
  if (!s) return fallback;
  return s.replace(/\s+/g, ' ').trim();
}

function asciiFallbackText(input: unknown, fallback = '') {
  const s = String(input ?? '').trim();
  if (!s) return fallback;
  return s
    .replace(/\u2022/g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s.,@:+\\/-_()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDateLocale(input: unknown, locale: 'cs' | 'en' = 'cs', withTime = true) {
  const value = String(input || '').trim();
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === 'en' ? 'en-US' : 'cs-CZ', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' });
}

function formatMoney(value: unknown, locale: 'cs' | 'en') {
  const num = typeof value === 'number' ? value : Number(value || 0);
  try {
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      maximumFractionDigits: 2,
    }).format(Number.isFinite(num) ? num : 0);
  } catch {
    return `${Number.isFinite(num) ? num : 0} CZK`;
  }
}

function wrapLines(font: Pick<PDFFont, 'widthOfTextAtSize'>, text: string, size: number, maxWidth: number) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    let width = 0;
    try {
      width = font.widthOfTextAtSize(next, size);
    } catch {
      width = font.widthOfTextAtSize(asciiFallbackText(next), size);
    }
    if (width <= maxWidth || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function ticketStatusLabel(status: string, lang: 'cs' | 'en') {
  const s = String(status || '').trim();
  if (s === 'confirmed') return lang === 'en' ? 'Paid / confirmed' : 'Zaplaceno / potvrzeno';
  if (s === 'reserved') return lang === 'en' ? 'Awaiting bank transfer' : 'Ceka na bankovni prevod';
  if (s === 'waitlist') return lang === 'en' ? 'Waitlist' : 'Nahradnik';
  if (s === 'cancelled') return lang === 'en' ? 'Cancelled' : 'Stornovano';
  return s || (lang === 'en' ? 'Unknown' : 'Neznamy stav');
}

function sanitizeFileBase(input: string) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function buildTicketPdfUrl(token: string, lang: 'cs' | 'en' = 'cs') {
  return `${getPublicBaseUrl()}/api/rsvp/ticket-pdf?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`;
}

export function buildTicketPdfFileName(input: { eventTitle?: string; token?: string }) {
  const base = sanitizeFileBase(String(input.eventTitle || 'ticket'));
  const tokenPart = sanitizeFileBase(String(input.token || '')).slice(0, 16);
  const fileBase = [base || 'ticket', tokenPart || 'pupen'].filter(Boolean).join('-');
  return {
    utf8: `${fileBase}.pdf`,
    ascii: `${asciiFallbackText(fileBase, 'ticket')}.pdf`,
  };
}

export async function buildTicketPdfBytes(input: {
  event: TicketPdfEvent;
  rsvp: TicketPdfRsvp;
  lang?: 'cs' | 'en';
}) {
  const lang = input.lang === 'en' ? 'en' : 'cs';
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { font, fontBold } = await getPdfFonts(pdfDoc);

  const width = 595.28;
  const margin = 42;
  let y = 796;
  const green = rgb(0.08, 0.6, 0.26);
  const black = rgb(0.08, 0.08, 0.08);
  const gray = rgb(0.38, 0.38, 0.38);
  const light = rgb(0.9, 0.9, 0.9);
  const card = rgb(0.98, 0.98, 0.97);

  const drawSafe = (
    text: unknown,
    opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> },
  ) => {
    const value = cleanText(text, '');
    if (!value) return;
    try {
      page.drawText(value, opts);
    } catch {
      page.drawText(asciiFallbackText(value), opts);
    }
  };

  const labelValue = (label: string, value: string) => {
    drawSafe(label, { x: margin, y, size: 9, font: fontBold, color: gray });
    const lines = wrapLines(font, value || '-', 11, width - margin * 2 - 160);
    lines.forEach((lineText, index) => {
      drawSafe(lineText || '-', { x: margin + 160, y: y - index * 14, size: 11, font, color: black });
    });
    y -= Math.max(18, lines.length * 14 + 4);
  };

  const title = cleanText(lang === 'en' ? input.event.title_en || input.event.title : input.event.title, 'Pupen');
  const location = cleanText(lang === 'en' ? input.event.location_en || input.event.location : input.event.location, '-');
  const token = cleanText(input.rsvp.qr_token || input.rsvp.qr_code, '');
  const attendees = Array.isArray(input.rsvp.attendees) ? input.rsvp.attendees : [];
  const attendeeNames = attendees
    .map((attendee) => cleanText((attendee as { name?: string | null })?.name, ''))
    .filter(Boolean);
  const paymentMethod = cleanText(input.rsvp.payment_method, '');
  const paymentLabel =
    paymentMethod === 'prevod'
      ? lang === 'en'
        ? 'Bank transfer'
        : 'Bankovni prevod'
      : paymentMethod === 'hotove'
        ? lang === 'en'
          ? 'On-site payment'
          : 'Platba na miste'
        : paymentMethod || '-';
  const validateUrl = `${getPublicBaseUrl()}/${lang}/admin/tickets/validate?token=${encodeURIComponent(token)}`;

  page.drawRectangle({ x: 0, y: 835, width, height: 6, color: green });
  page.drawRectangle({ x: margin, y: 680, width: width - margin * 2, height: 122, borderColor: light, borderWidth: 1, color: card });
  drawSafe(lang === 'en' ? 'EVENT TICKET' : 'VSTUPENKA', { x: margin, y, size: 12, font: fontBold, color: green });
  y -= 18;
  drawSafe('PUPEN', { x: margin, y, size: 26, font: fontBold, color: black });
  y -= 22;
  const titleLines = wrapLines(fontBold, title, 18, width - margin * 2 - 200);
  titleLines.forEach((lineText, index) => {
    drawSafe(lineText, { x: margin, y: y - index * 21, size: 18, font: fontBold, color: black });
  });
  y -= titleLines.length * 21 + 8;
  drawSafe(formatDateLocale(input.event.date, lang) || '-', { x: margin, y, size: 11, font, color: gray });
  y -= 16;
  drawSafe(location, { x: margin, y, size: 11, font, color: gray });

  if (token) {
    try {
      const qrPng = await QRCode.toDataURL(validateUrl, { margin: 1, width: 640, color: { dark: '#111827', light: '#FFFFFF' } });
      const bytes = Buffer.from(qrPng.split(',')[1] || '', 'base64');
      const embedded = await pdfDoc.embedPng(bytes);
      page.drawImage(embedded, { x: width - margin - 128, y: 690, width: 110, height: 110 });
    } catch {}
  }

  y = 650;
  labelValue(lang === 'en' ? 'Ticket holder' : 'Drzitel vstupenky', cleanText(input.rsvp.name || input.rsvp.email, '-'));
  labelValue(lang === 'en' ? 'Contact e-mail' : 'Kontaktni e-mail', cleanText(input.rsvp.email, '-'));
  labelValue(lang === 'en' ? 'Status' : 'Stav', ticketStatusLabel(cleanText(input.rsvp.status, ''), lang));
  labelValue(lang === 'en' ? 'Payment method' : 'Zpusob platby', paymentLabel);
  if (input.rsvp.price_total != null) {
    labelValue(
      lang === 'en' ? 'Price' : 'Cena',
      `${formatMoney(input.rsvp.price_total, lang)}${
        cleanText(lang === 'en' ? input.rsvp.pricing_label_en || input.rsvp.pricing_label : input.rsvp.pricing_label, '')
          ? ` • ${cleanText(lang === 'en' ? input.rsvp.pricing_label_en || input.rsvp.pricing_label : input.rsvp.pricing_label, '')}`
          : ''
      }`,
    );
  }
  if (cleanText(input.rsvp.variable_symbol, '')) {
    labelValue('VS', cleanText(input.rsvp.variable_symbol, '-'));
  }
  if (cleanText(input.rsvp.expires_at, '')) {
    labelValue(lang === 'en' ? 'Valid until' : 'Platnost rezervace do', formatDateLocale(input.rsvp.expires_at, lang));
  }

  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
  y -= 24;
  drawSafe(lang === 'en' ? 'Participants' : 'Ucastnici', { x: margin, y, size: 12, font: fontBold, color: green });
  y -= 18;
  const list = attendeeNames.length ? attendeeNames : [cleanText(input.rsvp.name || input.rsvp.email, '-')];
  list.forEach((attendee, index) => {
    const lines = wrapLines(font, `${index + 1}. ${attendee}`, 11, width - margin * 2);
    lines.forEach((lineText, lineIndex) => {
      drawSafe(lineText, { x: margin, y: y - lineIndex * 14, size: 11, font, color: black });
    });
    y -= lines.length * 14 + 4;
  });

  y -= 6;
  page.drawRectangle({ x: margin, y: y - 72, width: width - margin * 2, height: 72, borderColor: light, borderWidth: 1, color: rgb(1, 1, 1) });
  drawSafe(lang === 'en' ? 'Ticket token' : 'Token vstupenky', { x: margin + 14, y: y - 20, size: 10, font: fontBold, color: gray });
  const tokenLines = wrapLines(fontBold, token || '-', 13, width - margin * 2 - 28);
  tokenLines.forEach((lineText, index) => {
    drawSafe(lineText, { x: margin + 14, y: y - 40 - index * 15, size: 13, font: fontBold, color: black });
  });

  drawSafe(
    lang === 'en'
      ? 'Show this PDF or the QR code at the entrance. Organizer validation runs against the internal Pupen check-in URL.'
      : 'Toto PDF nebo QR kod predlozte pri vstupu. Poradatel overi vstupenku proti interni Pupen check-in URL.',
    { x: margin, y: 86, size: 9, font, color: gray },
  );
  drawSafe(validateUrl, { x: margin, y: 66, size: 8, font, color: gray });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

export async function buildTicketPdfAttachment(input: {
  event: TicketPdfEvent;
  rsvp: TicketPdfRsvp;
  lang?: 'cs' | 'en';
}) {
  const token = cleanText(input.rsvp.qr_token || input.rsvp.qr_code, '');
  if (!token) return null;
  const bytes = await buildTicketPdfBytes(input);
  const names = buildTicketPdfFileName({ eventTitle: input.event.title || '', token });
  return {
    filename: names.utf8,
    content: bytes,
    contentType: 'application/pdf',
  } as Attachment;
}
