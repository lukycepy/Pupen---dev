import { PDFDocument, rgb } from 'pdf-lib';
import { getPdfFonts } from '@/lib/pdf/fonts';

function asciiFallbackText(input: any, fallback = '-') {
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

function cleanText(input: any, fallback = '-') {
  const s = String(input ?? '').replace(/\u0000/g, '').trim();
  if (!s) return fallback;
  return s.replace(/\u2022/g, '•').replace(/\s+/g, ' ').trim();
}

function formatDateCs(input: any) {
  try {
    const d = input ? new Date(input) : null;
    if (!d || Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('cs-CZ');
  } catch {
    return '';
  }
}

async function loadLogoPngBytes(): Promise<Uint8Array | null> {
  try {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const p = path.join(process.cwd(), 'public', 'logo.png');
    const buf = await fs.readFile(p);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function embedDataUrlImage(pdf: PDFDocument, dataUrl: string) {
  const s = String(dataUrl || '');
  const m = s.match(/^data:(image\/(png|jpeg|jpg));base64,(.*)$/i);
  if (!m) return null;
  const mime = String(m[1] || '').toLowerCase();
  const b64 = String(m[3] || '');
  const bytes = Uint8Array.from(Buffer.from(b64, 'base64'));
  if (mime.includes('png')) return pdf.embedPng(bytes);
  return pdf.embedJpg(bytes);
}

function labelMembershipType(mt: any) {
  const v = String(mt || '').trim().toLowerCase();
  if (v === 'external') return 'Externi';
  if (v === 'regular') return 'Radne';
  return v || '-';
}

function labelStatus(status: any) {
  const v = String(status || '').trim().toLowerCase();
  if (v === 'approved') return 'Schvaleno';
  if (v === 'rejected') return 'Zamitnuto';
  if (v === 'pending') return 'Ceka';
  return v || '-';
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

export async function buildApplicationPdfBytes(app: any) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { font, fontBold } = await getPdfFonts(pdfDoc);

  const margin = 48;
  const width = 595.28;
  let y = 800;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  const light = rgb(0.92, 0.92, 0.92);
  const green = rgb(0.08, 0.6, 0.26);

  const drawSafe = (text: any, opts: { x: number; y: number; size: number; font: any; color: any }) => {
    const primary = cleanText(text, '');
    if (!primary) return;
    try {
      page.drawText(primary, opts);
    } catch {
      page.drawText(asciiFallbackText(primary, ''), opts);
    }
  };

  const logoBytes = await loadLogoPngBytes();
  if (logoBytes) {
    try {
      const logo = await pdfDoc.embedPng(logoBytes);
      const targetW = 60;
      const s = targetW / logo.width;
      const targetH = logo.height * s;
      page.drawImage(logo, { x: margin, y: y - 10, width: targetW, height: targetH });
    } catch {}
  }

  drawSafe('PŘIHLÁŠKA DO SPOLKU PUPEN, Z. S.', { x: margin + 74, y, size: 18, font: fontBold, color: black });
  y -= 24;
  drawSafe('Studentský spolek Pupen, z.s. • Kamýcká 129, Suchdol, 165 00 Praha', { x: margin + 74, y, size: 9, font, color: gray });
  y -= 12;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
  y -= 18;

  const section = (title: string) => {
    drawSafe(title, { x: margin, y, size: 11, font: fontBold, color: green });
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
    y -= 14;
  };

  const row = (label: string, value: any) => {
    drawSafe(label, { x: margin, y, size: 9, font: fontBold, color: gray });
    const valueX = margin + 180;
    const valueWidth = width - margin - valueX;
    const rawValue = cleanText(value, '-');
    const valueLines = wrapLines(font, rawValue, 11, valueWidth);
    for (let i = 0; i < valueLines.length; i += 1) {
      drawSafe(valueLines[i], { x: valueX, y: y - i * 14, size: 11, font, color: black });
    }
    y -= Math.max(16, valueLines.length * 14);
  };

  const firstName = cleanText(app?.first_name || '', '');
  const lastName = cleanText(app?.last_name || '', '');
  const fullName = cleanText(`${firstName} ${lastName}`.trim() || app?.name || '', '-');
  const submittedAt = (app as any)?.created_at || app?.submitted_on || '';
  const membershipType = labelMembershipType(app?.decision_membership_type || app?.membership_type);

  section('OSOBNÍ ÚDAJE');
  row('Jméno a příjmení', fullName);
  row('E-mail', app?.email || '-');
  row('Telefon', app?.phone || '-');
  row('Typ členství', membershipType);
  row('Datum podání', formatDateCs(submittedAt) || '-');

  if (String(app?.membership_type || '').trim().toLowerCase() !== 'external') {
    const universityEmail = app?.university_email || '';
    const field = app?.field_of_study || '';
    const year = app?.study_year || '';
    if (String(universityEmail || field || year).trim()) {
      section('STUDIUM');
      if (universityEmail) row('Univerzitní e-mail', universityEmail);
      if (field) row('Obor', field);
      if (year) row('Ročník', year);
    }
  }

  section('ADRESA');
  row('Adresa bydliště', app?.address || '-');

  section('STAV');
  row('Status', labelStatus(app?.status));
  if (app?.decided_at) row('Rozhodnuto', formatDateCs(app.decided_at) || '-');
  if (app?.decided_by_email) row('Rozhodl', app.decided_by_email);
  const rejection = app?.rejection_reason || app?.decision_reason;
  if (String(app?.status || '') === 'rejected' && rejection) row('Důvod', rejection);

  const embedSig = async (label: string, dataUrl: string) => {
    const img = await embedDataUrlImage(pdfDoc, dataUrl);
    if (!img) return;
    y -= 6;
    drawSafe(label, { x: margin, y, size: 10, font: fontBold, color: gray });
    y -= 12;
    const targetW = 260;
    const h = (img.height / img.width) * targetW;
    page.drawRectangle({ x: margin, y: y - h - 10, width: targetW + 16, height: h + 16, borderColor: light, borderWidth: 1, color: rgb(1, 1, 1) });
    page.drawImage(img, { x: margin + 8, y: y - h - 2, width: targetW, height: h });
    y -= h + 24;
  };

  const applicantSig = String(app?.applicant_signature || app?.signature_data_url || '').trim();
  if (applicantSig) {
    try {
      await embedSig('Podpis žadatele', applicantSig);
    } catch {}
  }

  const adminSig = String(app?.chairwoman_signature || app?.admin_signature_data_url || '').trim();
  if (adminSig) {
    try {
      await embedSig('Podpis za spolek', adminSig);
    } catch {}
  }

  y = Math.max(y, 70);
  drawSafe('V Praze, v sídle spolku Studentský spolek Pupen, z.s.', { x: margin, y: 60, size: 9, font, color: gray });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
