import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';
import { getPdfFonts } from '@/lib/pdf/fonts';
import { getServerSupabase } from '@/lib/supabase-server';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';
import { formatDatePrague } from '@/lib/time/prague';

export const MEMBERSHIP_APPLICATION_PDF_BUCKET = 'member_applications';
const TEMPLATE_PDF_URL = new URL('../../assets/pdf-templates/prihlaska.pdf', import.meta.url);

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationPdfApplication {
  id?: unknown;
  created_at?: unknown;
  status?: unknown;
  meta?: JsonRecord | null;
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  address?: unknown;
  faculty?: unknown;
}

interface PdfImageInput {
  bytes: Uint8Array;
  mimeType: string;
}

interface MembershipApplicationPdfBuildInput {
  templatePdfBytes: Uint8Array;
  application: MembershipApplicationPdfApplication;
  applicantSignature: PdfImageInput | null;
  chairAuth: PdfImageInput | null;
}

interface MembershipApplicationStoredFileRow {
  id?: string | number | null;
  storage_bucket?: string | null;
  storage_path?: string | null;
  mime_type?: string | null;
  meta?: JsonRecord | null;
}

interface MembershipApplicationInsertedFileRow {
  id?: string | number | null;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

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

function wrapLines(font: Pick<PDFFont, 'widthOfTextAtSize'>, text: string, size: number, maxWidth: number) {
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

async function loadTemplatePdfBytes() {
  const buf = await readFile(TEMPLATE_PDF_URL);
  if (buf?.length) return new Uint8Array(buf);
  throw new Error('Missing template PDF');
}

async function downloadStorageFile(bucket: string, storagePath: string) {
  const srv = getServerSupabase();
  const res = await srv.storage.from(bucket).download(storagePath);
  if (res.error) throw res.error;
  const ab = await res.data.arrayBuffer();
  return new Uint8Array(ab);
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

function drawCheckbox(
  page: Pick<PDFPage, 'drawLine'>,
  input: { checked: boolean; x: number; y: number; size?: number },
) {
  const size = input.size ?? 10;
  const x = input.x;
  const y = input.y;
  if (!input.checked) return;
  const s = size;
  page.drawLine({ start: { x: x + 1, y: y + 1 }, end: { x: x + s - 1, y: y + s - 1 }, thickness: 1.2, color: rgb(0, 0, 0) });
  page.drawLine({ start: { x: x + 1, y: y + s - 1 }, end: { x: x + s - 1, y: y + 1 }, thickness: 1.2, color: rgb(0, 0, 0) });
}

function drawSignatureImage(
  page: Pick<PDFPage, 'drawImage'>,
  img: Awaited<ReturnType<typeof embedImage>>,
  box: { x: number; y: number; w: number; h: number },
) {
  const scale = Math.min(box.w / img.width, box.h / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  page.drawImage(img, {
    x: box.x + (box.w - width) / 2,
    y: box.y + (box.h - height) / 2,
    width,
    height,
  });
}

async function embedImage(pdfDoc: PDFDocument, bytes: Uint8Array, mimeType: string) {
  const mt = String(mimeType || '').toLowerCase();
  if (mt.includes('png')) return await pdfDoc.embedPng(bytes);
  if (mt.includes('jpeg') || mt.includes('jpg')) return await pdfDoc.embedJpg(bytes);

  const sharpModule = await import('sharp');
  const sharpCandidate = 'default' in sharpModule ? sharpModule.default : sharpModule;
  const sharp = sharpCandidate as (input: Uint8Array) => { png(): { toBuffer(): Promise<Buffer> } };
  const png = await sharp(bytes).png().toBuffer();
  return await pdfDoc.embedPng(new Uint8Array(png));
}

export async function buildMembershipApplicationPdfBytes(input: MembershipApplicationPdfBuildInput) {
  const pdfDoc = await PDFDocument.load(input.templatePdfBytes);
  const { font } = await getPdfFonts(pdfDoc);

  const pages = pdfDoc.getPages();
  if (!pages.length) throw new Error('Template PDF has no pages');

  const app = input.application;
  const meta = toRecord(app.meta);
  const decision = toRecord(meta.decision);

  const drawSafe = (
    page: Pick<PDFPage, 'drawText'>,
    text: unknown,
    opts: { x: number; y: number; size: number; maxWidth?: number },
  ) => {
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

  const firstName = cleanText(meta.first_name, cleanText(app.name, ''));
  const lastName = cleanText(meta.last_name, '');
  const email = cleanText(app.email, '');
  const phone = cleanText(app.phone, '');
  const address = cleanText(app.address, '');
  const membershipType = cleanText(decision.membership_type || meta.membership_type, '');
  const universityEmail = cleanText(meta.university_email, '');
  const fieldOfStudy = cleanText(meta.field_of_study, cleanText(app.faculty, ''));
  const studyYear = cleanText(meta.study_year, '');
  const signedOn = cleanText(meta.signed_on, formatDatePrague(app.created_at || new Date(), 'cs'));
  const gdprConsent = meta.gdpr_consent === true;

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
    drawSignatureImage(page1, img, { x: 85, y: 190, w: 200, h: 55 });

    const gdprPage = pages[1];
    if (gdprPage) {
      drawSafe(gdprPage, signedOn, { x: 118, y: 128, size: 10, maxWidth: 120 });
      drawSignatureImage(gdprPage, img, { x: 392, y: 88, w: 150, h: 50 });
    }
  }

  if (input.chairAuth) {
    const img = await embedImage(pdfDoc, input.chairAuth.bytes, input.chairAuth.mimeType);
    drawSignatureImage(page1, img, { x: 315, y: 190, w: 200, h: 55 });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

export async function ensureMembershipApplicationPdf(params: {
  applicationId: string;
  generatedByEmail?: string | null;
  expiresIn?: number;
}) {
  const srv = getServerSupabase();
  const applicationId = cleanText(params.applicationId);
  if (!applicationId) throw new Error('Missing applicationId');

  const appRes = await srv
    .from('membership_applications_v2')
    .select('id,status,created_at,meta,name,email,phone,address,faculty')
    .eq('id', applicationId)
    .maybeSingle<MembershipApplicationPdfApplication>();
  if (appRes.error) throw appRes.error;
  if (!appRes.data) throw new Error('Not found');

  const status = cleanText(appRes.data.status);
  if (!status || status === 'pending') throw new Error('Not decided');

  const expiresIn = Math.max(60, Math.min(60 * 60 * 24 * 7, Number(params.expiresIn || 0) || 0));

  const existing = await srv
    .from('membership_application_files')
    .select('id,storage_bucket,storage_path,mime_type')
    .eq('application_id', applicationId)
    .contains('meta', { kind: 'application_pdf' })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<MembershipApplicationStoredFileRow>();
  if (existing.error) throw existing.error;

  if (existing.data?.id) {
    const bucket = cleanText(existing.data.storage_bucket, MEMBERSHIP_APPLICATION_PDF_BUCKET);
    const path = cleanText(existing.data.storage_path);
    const signedUrl =
      bucket && path && expiresIn
        ? (await srv.storage.from(bucket).createSignedUrl(path, expiresIn)).data?.signedUrl || null
        : null;
    return {
      fileId: existing.data.id || null,
      alreadyExists: true as const,
      signedUrl: cleanText(signedUrl) || null,
      application: appRes.data,
    };
  }

  const filesRes = await srv
    .from('membership_application_files')
    .select('id,storage_bucket,storage_path,mime_type,meta')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false });
  if (filesRes.error) throw filesRes.error;
  const files = Array.isArray(filesRes.data) ? (filesRes.data as MembershipApplicationStoredFileRow[] & Array<{ meta?: JsonRecord | null }>) : [];

  const applicantSignatureFile =
    files.find((file) => cleanText(file.meta?.kind) === 'applicant_signature') || null;
  if (!applicantSignatureFile) throw new Error('Missing applicant signature');

  const meta = toRecord(appRes.data.meta);
  const decision = toRecord(meta.decision);
  const chairAuthFileId = cleanText(decision.chair_auth_file_id);
  if (!chairAuthFileId) throw new Error('Missing chair auth');

  const chairAuthFile =
    files.find((file) => cleanText(file.id) === chairAuthFileId) || null;
  if (!chairAuthFile) throw new Error('Invalid chair auth file');

  const [templatePdfBytes, applicantSigBytes, chairAuthBytes] = await Promise.all([
    loadTemplatePdfBytes(),
    downloadStorageFile(cleanText(applicantSignatureFile.storage_bucket, MEMBERSHIP_APPLICATION_PDF_BUCKET), cleanText(applicantSignatureFile.storage_path)),
    downloadStorageFile(cleanText(chairAuthFile.storage_bucket, MEMBERSHIP_APPLICATION_PDF_BUCKET), cleanText(chairAuthFile.storage_path)),
  ]);

  const pdfBytes = await buildMembershipApplicationPdfBytes({
    templatePdfBytes,
    application: appRes.data,
    applicantSignature: {
      bytes: applicantSigBytes,
      mimeType: cleanText(applicantSignatureFile.mime_type, 'image/png'),
    },
    chairAuth: {
      bytes: chairAuthBytes,
      mimeType: cleanText(chairAuthFile.mime_type, 'image/png'),
    },
  });

  const storagePath = buildMembershipApplicationPdfStoragePath(applicationId);
  const upload = await srv.storage.from(MEMBERSHIP_APPLICATION_PDF_BUCKET).upload(storagePath, pdfBytes, {
    upsert: true,
    contentType: 'application/pdf',
  });
  if (upload.error) throw upload.error;

  const { utf8: fileName } = formatMembershipApplicationPdfFileName({
    firstName: meta.first_name,
    lastName: meta.last_name,
    createdAt: appRes.data.created_at,
  });

  const ins = await withSchemaCacheRetry(srv, async () => {
    return await srv
      .from('membership_application_files')
      .insert([
        {
          application_id: applicationId,
          storage_bucket: MEMBERSHIP_APPLICATION_PDF_BUCKET,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: 'application/pdf',
          size_bytes: pdfBytes.length,
          meta: {
            kind: 'application_pdf',
            generated_at: new Date().toISOString(),
            generated_by_email: cleanText(params.generatedByEmail) || null,
            template: 'prihlaska.pdf',
          },
        },
      ])
      .select('id')
      .single<MembershipApplicationInsertedFileRow>();
  });
  if (ins.error) throw ins.error;

  const signedUrl =
    expiresIn > 0
      ? (await srv.storage.from(MEMBERSHIP_APPLICATION_PDF_BUCKET).createSignedUrl(storagePath, expiresIn)).data?.signedUrl || null
      : null;

  return {
    fileId: ins.data?.id || null,
    alreadyExists: false as const,
    signedUrl: cleanText(signedUrl) || null,
    application: appRes.data,
  };
}
