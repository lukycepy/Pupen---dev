import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import type { Attachment } from 'nodemailer/lib/mailer';
import { getServerSupabase } from '@/lib/supabase-server';
import { getPdfFonts } from '@/lib/pdf/fonts';
import { getPublicBaseUrl } from '@/lib/public-base-url';

export const GUARDIAN_CONSENT_BUCKET = 'guardian_consents';

type RsvpAttendee = {
  name?: string | null;
  birth_date?: string | null;
};

type EventData = {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
  date?: string | null;
  location?: string | null;
};

type RsvpData = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  attendees?: unknown;
  guardian_consent_document_bucket?: string | null;
  guardian_consent_document_path?: string | null;
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

function formatDateLocale(input: unknown, locale: 'cs' | 'en' = 'cs') {
  const value = String(input || '').trim();
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'cs-CZ');
}

function calculateAgeAtDate(birthDate: string, targetDate?: string | null) {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const target = targetDate ? new Date(targetDate) : new Date();
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(target.getTime())) return null;
  let age = target.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = target.getUTCMonth() - birth.getUTCMonth();
  const dayDelta = target.getUTCDate() - birth.getUTCDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) age -= 1;
  return age;
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

export function getMinorAttendees(attendees: unknown, eventDate?: string | null) {
  const items = Array.isArray(attendees) ? (attendees as RsvpAttendee[]) : [];
  return items
    .map((attendee) => {
      const birthDate = cleanText(attendee?.birth_date, '');
      if (!birthDate) return null;
      const age = calculateAgeAtDate(birthDate, eventDate);
      if (age == null || age >= 18) return null;
      return {
        name: cleanText(attendee?.name, ''),
        birthDate,
        age,
      };
    })
    .filter(Boolean) as Array<{ name: string; birthDate: string; age: number }>;
}

export function buildGuardianConsentUrls(token: string, lang: 'cs' | 'en' = 'cs') {
  const baseUrl = getPublicBaseUrl();
  return {
    downloadUrl: `${baseUrl}/api/rsvp/guardian-consent?token=${encodeURIComponent(token)}&lang=${encodeURIComponent(lang)}`,
    uploadUrl: `${baseUrl}/${lang}/souhlas/${encodeURIComponent(token)}`,
  };
}

function fileNameBase(input: { eventTitle?: string; rsvpId?: string }) {
  const title = cleanText(input.eventTitle, 'souhlas-zakonneho-zastupce')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${title || 'souhlas-zakonneho-zastupce'}-${String(input.rsvpId || 'rsvp').slice(0, 12)}`;
}

export function formatGuardianConsentFileName(input: { eventTitle?: string; rsvpId?: string }) {
  const base = fileNameBase(input);
  return {
    utf8: `${base}.pdf`,
    ascii: `${asciiFallbackText(base, 'guardian-consent')}.pdf`,
  };
}

export async function buildGuardianConsentPdfBytes(input: {
  event: EventData;
  rsvp: RsvpData;
  minors: Array<{ name: string; birthDate: string; age: number }>;
  lang?: 'cs' | 'en';
}) {
  const lang = input.lang === 'en' ? 'en' : 'cs';
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { font, fontBold } = await getPdfFonts(pdfDoc);

  const width = 595.28;
  const margin = 48;
  let y = 792;
  const green = rgb(0.08, 0.6, 0.26);
  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  const line = rgb(0.9, 0.9, 0.9);

  const drawSafe = (text: string, opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> }) => {
    try {
      page.drawText(text, opts);
    } catch {
      page.drawText(asciiFallbackText(text), opts);
    }
  };

  const block = (label: string, value: string) => {
    drawSafe(label, { x: margin, y, size: 9, font: fontBold, color: gray });
    const lines = wrapLines(font, value || '-', 11, width - margin * 2 - 160);
    lines.forEach((lineText, index) => {
      drawSafe(lineText || '-', { x: margin + 160, y: y - index * 14, size: 11, font, color: black });
    });
    y -= Math.max(18, lines.length * 14 + 2);
  };

  const rule = () => {
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: line });
    y -= 18;
  };

  page.drawRectangle({ x: 0, y: 835, width, height: 6, color: green });
  drawSafe(lang === 'en' ? 'GUARDIAN CONSENT' : 'SOUHLAS ZAKONNEHO ZASTUPCE', { x: margin, y, size: 22, font: fontBold, color: black });
  y -= 26;
  drawSafe(
    lang === 'en'
      ? 'Consent for participation of a minor in a Pupen event.'
      : 'Souhlas s ucasti nezletileho ucastnika na akci spolku Pupen.',
    { x: margin, y, size: 11, font, color: gray },
  );
  y -= 22;
  rule();

  block(lang === 'en' ? 'Event' : 'Akce', cleanText(lang === 'en' ? input.event.title_en || input.event.title : input.event.title, '-'));
  block(lang === 'en' ? 'Event date' : 'Datum akce', formatDateLocale(input.event.date, lang) || '-');
  block(lang === 'en' ? 'Location' : 'Misto', cleanText(input.event.location, '-'));
  block(lang === 'en' ? 'Registration contact' : 'Kontakt registrace', cleanText(`${input.rsvp.name || ''} ${input.rsvp.email ? `(${input.rsvp.email})` : ''}`, '-'));
  rule();

  drawSafe(lang === 'en' ? 'Minor participants' : 'Nezletili ucastnici', { x: margin, y, size: 12, font: fontBold, color: green });
  y -= 18;
  input.minors.forEach((minor, index) => {
    block(
      `${lang === 'en' ? 'Participant' : 'Ucastnik'} ${index + 1}`,
      `${cleanText(minor.name, '-')}${minor.birthDate ? `, ${lang === 'en' ? 'born' : 'nar.'} ${formatDateLocale(minor.birthDate, lang)}` : ''}${minor.age >= 0 ? `, ${minor.age} ${lang === 'en' ? 'years' : 'let'}` : ''}`,
    );
  });

  rule();
  drawSafe(lang === 'en' ? 'Guardian details' : 'Udaje zakonneho zastupce', { x: margin, y, size: 12, font: fontBold, color: green });
  y -= 18;

  const blankLine = (label: string) => {
    drawSafe(label, { x: margin, y, size: 10, font: fontBold, color: gray });
    page.drawLine({ start: { x: margin + 165, y: y + 2 }, end: { x: width - margin, y: y + 2 }, thickness: 1, color: gray });
    y -= 28;
  };

  blankLine(lang === 'en' ? 'Guardian name' : 'Jmeno a prijmeni');
  blankLine(lang === 'en' ? 'Phone / email' : 'Telefon / e-mail');
  blankLine(lang === 'en' ? 'Date and place' : 'Datum a misto');

  drawSafe(
    lang === 'en'
      ? 'I confirm that I am the legal guardian of the minor participant(s) listed above and I agree to their participation in the event.'
      : 'Potvrzuji, ze jsem zakonnym zastupcem vyse uvedenych nezletilych ucastniku a souhlasim s jejich ucasti na akci.',
    { x: margin, y, size: 10, font, color: black },
  );
  y -= 40;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin - 250, y }, thickness: 1, color: gray });
  drawSafe(lang === 'en' ? 'Signature of guardian' : 'Podpis zakonneho zastupce', { x: margin, y: y - 14, size: 9, font, color: gray });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function ensureGuardianConsentPdf(input: {
  event: EventData;
  rsvp: RsvpData & { qr_token?: string | null; qr_code?: string | null };
  minors: Array<{ name: string; birthDate: string; age: number }>;
  lang?: 'cs' | 'en';
}) {
  const lang = input.lang === 'en' ? 'en' : 'cs';
  if (!input.minors.length || !input.rsvp.id) {
    return { required: false as const, uploaded: false as const, attachment: null as Attachment | null, downloadUrl: '', uploadUrl: '' };
  }

  const supabase = getServerSupabase();
  const existingBucket = cleanText(input.rsvp.guardian_consent_document_bucket, '');
  const existingPath = cleanText(input.rsvp.guardian_consent_document_path, '');
  let pdfBytes: Buffer | null = null;
  let bucket = existingBucket || GUARDIAN_CONSENT_BUCKET;
  let path = existingPath;

  if (bucket && path) {
    try {
      const download = await supabase.storage.from(bucket).download(path);
      if (!download.error) {
        const ab = await download.data.arrayBuffer();
        pdfBytes = Buffer.from(ab);
      }
    } catch {}
  }

  if (!pdfBytes) {
    pdfBytes = await buildGuardianConsentPdfBytes(input);
    path = path || `generated/${input.rsvp.id}/${lang}/${fileNameBase({ eventTitle: input.event.title || '', rsvpId: input.rsvp.id })}.pdf`;
    await supabase.storage.from(bucket).upload(path, pdfBytes, { contentType: 'application/pdf', upsert: true });
    try {
      await supabase
        .from('rsvp')
        .update({
          has_minor_attendee: true,
          guardian_consent_required: true,
          guardian_consent_generated_at: new Date().toISOString(),
          guardian_consent_status: 'generated',
          guardian_consent_document_bucket: bucket,
          guardian_consent_document_path: path,
        })
        .eq('id', String(input.rsvp.id));
    } catch {}
  }

  const token = cleanText(input.rsvp.qr_token || input.rsvp.qr_code, '');
  const urls = token ? buildGuardianConsentUrls(token, lang) : { downloadUrl: '', uploadUrl: '' };
  const names = formatGuardianConsentFileName({ eventTitle: input.event.title || '', rsvpId: input.rsvp.id });

  return {
    required: true as const,
    uploaded: false as const,
    bucket,
    path,
    attachment: {
      filename: names.utf8,
      content: pdfBytes,
      contentType: 'application/pdf',
    } as Attachment,
    downloadUrl: urls.downloadUrl,
    uploadUrl: urls.uploadUrl,
  };
}
