import { PDFDocument, rgb } from 'pdf-lib';
import { getPdfFonts } from '@/lib/pdf/fonts';

export const MEMBERSHIP_APPLICATION_PDF_BUCKET = 'member_applications';

function cleanText(input: any, fallback = '') {
  const s = String(input ?? '').replace(/\u0000/g, '').trim();
  if (!s) return fallback;
  return s.replace(/\s+/g, ' ').trim();
}

function asciiFallbackText(input: any, fallback = '') {
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

function wrapLines(font: any, text: string, size: number, maxWidth: number) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
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
    current = w;
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function sanitizeFileBase(input: string) {
  return String(input || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

export function buildMembershipApplicationPdfStoragePath(applicationId: string) {
  const id = String(applicationId || '').trim() || 'application';
  return `membership_applications_v2/${id}/application.pdf`;
}

export function formatMembershipApplicationPdfFileName(input: { firstName?: any; lastName?: any; createdAt?: any }) {
  const first = sanitizeFileBase(cleanText(input.firstName, ''));
  const last = sanitizeFileBase(cleanText(input.lastName, ''));
  const date = String(input.createdAt || '').slice(0, 10).replace(/[^\d-]/g, '') || '';
  const base = sanitizeFileBase([first, last, date].filter(Boolean).join('_')) || 'prihlaska';

  const utf8 = `${base}.pdf`;
  const ascii = `${sanitizeFileBase(asciiFallbackText(base, 'prihlaska'))}.pdf`;
  return { utf8, ascii };
}

function drawCheckbox(page: any, input: { checked: boolean; x: number; y: number; size?: number }) {
  const size = input.size ?? 10;
  const x = input.x;
  const y = input.y;
  if (!input.checked) return;
  const s = size;
  page.drawLine({ start: { x: x + 1, y: y + 1 }, end: { x: x + s - 1, y: y + s - 1 }, thickness: 1.2, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: x + 1, y: y + s - 1 }, end: { x: x + s - 1, y: y + 1 }, thickness: 1.2, color: rgb(0, 0, 0) });
}

async function embedImage(pdfDoc: PDFDocument, bytes: Uint8Array, mimeType: string) {
  const mt = String(mimeType || '').toLowerCase();
  if (mt.includes('png')) return await pdfDoc.embedPng(bytes);
  if (mt.includes('jpeg') || mt.includes('jpg')) return await pdfDoc.embedJpg(bytes);

  const sharpMod: any = await import('sharp');
  const sharp = sharpMod?.default || sharpMod;
  const png = await sharp(bytes).png().toBuffer();
  return await pdfDoc.embedPng(new Uint8Array(png));
}

export async function buildMembershipApplicationPdfBytes(input: {
  templatePdfBytes: Uint8Array;
  application: any;
  applicantSignature: { bytes: Uint8Array; mimeType: string } | null;
  chairAuth: { bytes: Uint8Array; mimeType: string } | null;
}) {
  const pdfDoc = await PDFDocument.load(input.templatePdfBytes);
  const { font } = await getPdfFonts(pdfDoc);

  const pages = pdfDoc.getPages();
  if (!pages.length) throw new Error('Template PDF has no pages');

  const app = input.application || {};
  const meta = (app as any)?.meta && typeof (app as any)?.meta === 'object' ? (app as any).meta : {};
  const decision = meta?.decision && typeof meta.decision === 'object' ? meta.decision : {};

  const drawSafe = (page: any, text: any, opts: { x: number; y: number; size: number; maxWidth?: number }) => {
    const primary = cleanText(text, '');
    if (!primary) return;
    const size = opts.size;
    const x = opts.x;
    const y = opts.y;
    const maxWidth = opts.maxWidth ?? 0;

    const lines = maxWidth > 0 ? wrapLines(font, primary, size, maxWidth) : [primary];
    for (let i = 0; i < Math.min(2, lines.length); i += 1) {
      const line = lines[i] || '';
      try {
        page.drawText(line, { x, y: y - i * (size + 2), size, font, color: rgb(0, 0, 0) });
      } catch {
        page.drawText(asciiFallbackText(line), { x, y: y - i * (size + 2), size, font, color: rgb(0, 0, 0) });
      }
    }
  };

  const page1 = pages[0];

  const firstName = cleanText(meta?.first_name, cleanText(app?.name, ''));
  const lastName = cleanText(meta?.last_name, '');
  const email = cleanText(app?.email, '');
  const phone = cleanText(app?.phone, '');
  const address = cleanText(app?.address, '');
  const membershipType = cleanText(decision?.membership_type || meta?.membership_type, '');
  const universityEmail = cleanText(meta?.university_email, '');
  const fieldOfStudy = cleanText(meta?.field_of_study, cleanText(app?.faculty, ''));
  const studyYear = cleanText(meta?.study_year, '');
  const signedOn = cleanText(meta?.signed_on, '');
  const gdprConsent = meta?.gdpr_consent === true;

  drawSafe(page1, firstName, { x: 120, y: 718, size: 10, maxWidth: 180 });
  drawSafe(page1, lastName, { x: 340, y: 718, size: 10, maxWidth: 200 });
  drawSafe(page1, email, { x: 120, y: 692, size: 10, maxWidth: 250 });
  drawSafe(page1, phone, { x: 420, y: 692, size: 10, maxWidth: 150 });
  drawSafe(page1, address, { x: 120, y: 666, size: 10, maxWidth: 460 });

  drawSafe(page1, universityEmail, { x: 120, y: 640, size: 10, maxWidth: 250 });
  drawSafe(page1, fieldOfStudy, { x: 120, y: 614, size: 10, maxWidth: 330 });
  drawSafe(page1, studyYear, { x: 470, y: 614, size: 10, maxWidth: 100 });

  drawSafe(page1, signedOn, { x: 120, y: 250, size: 10, maxWidth: 140 });

  drawCheckbox(page1, { checked: membershipType === 'regular', x: 110, y: 592, size: 10 });
  drawCheckbox(page1, { checked: membershipType === 'external', x: 210, y: 592, size: 10 });
  drawCheckbox(page1, { checked: gdprConsent, x: 110, y: 360, size: 10 });

  if (input.applicantSignature) {
    const img = await embedImage(pdfDoc, input.applicantSignature.bytes, input.applicantSignature.mimeType);
    const box = { x: 85, y: 190, w: 200, h: 55 };
    const scale = Math.min(box.w / img.width, box.h / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    page1.drawImage(img, { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, width: w, height: h });
  }

  if (input.chairAuth) {
    const img = await embedImage(pdfDoc, input.chairAuth.bytes, input.chairAuth.mimeType);
    const box = { x: 315, y: 190, w: 200, h: 55 };
    const scale = Math.min(box.w / img.width, box.h / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    page1.drawImage(img, { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, width: w, height: h });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
