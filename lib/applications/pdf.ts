import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function safeText(input: any, fallback = '-') {
  const s = String(input ?? '').trim();
  if (!s) return fallback;
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s.,@:\\/-_()]/g, '?');
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

export async function buildApplicationPdfBytes(app: any) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = 595.28;
  let y = 800;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  const light = rgb(0.92, 0.92, 0.92);
  const green = rgb(0.08, 0.6, 0.26);

  const logoBytes = await loadLogoPngBytes();
  if (logoBytes) {
    try {
      const logo = await pdfDoc.embedPng(logoBytes);
      const targetW = 54;
      const s = targetW / logo.width;
      const targetH = logo.height * s;
      page.drawImage(logo, { x: margin, y: y - 10, width: targetW, height: targetH });
    } catch {}
  }

  page.drawText(safeText('PŘIHLÁŠKA DO SPOLKU PUPEN, Z. S.'), {
    x: margin + 70,
    y,
    size: 16,
    font: fontBold,
    color: black,
  });
  y -= 22;
  page.drawText(safeText('Studentský spolek Pupen, z. s. • Kamýcká 129, Suchdol, 165 00 Praha'), {
    x: margin + 70,
    y,
    size: 9,
    font,
    color: gray,
  });
  y -= 12;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
  y -= 18;

  const section = (title: string) => {
    page.drawText(safeText(title), { x: margin, y, size: 11, font: fontBold, color: green });
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
    y -= 14;
  };

  const row = (label: string, value: any) => {
    page.drawText(safeText(label), { x: margin, y, size: 9, font: fontBold, color: gray });
    page.drawText(safeText(value), { x: margin + 160, y, size: 11, font, color: black });
    y -= 16;
  };

  const firstName = safeText(app?.first_name || '');
  const lastName = safeText(app?.last_name || '');
  const fullName = safeText(`${firstName} ${lastName}`.trim() || app?.name || '', '-');
  const submittedAt = (app as any)?.created_at || app?.submitted_on || '';
  const membershipType = String(app?.membership_type || '').trim() || '-';

  section('OSOBNÍ ÚDAJE');
  row('Jméno a příjmení', fullName);
  row('E-mail', app?.email || '-');
  row('Telefon', app?.phone || '-');
  row('Typ členství', membershipType);
  row('Datum podání', formatDateCs(submittedAt) || '-');

  section('ADRESA');
  row('Adresa bydliště', app?.address || '-');

  section('STAV');
  row('Status', app?.status || '-');
  if (app?.decided_at) row('Rozhodnuto', formatDateCs(app.decided_at) || '-');
  if (app?.decided_by_email) row('Rozhodl', app.decided_by_email);
  const rejection = app?.rejection_reason || app?.decision_reason;
  if (String(app?.status || '') === 'rejected' && rejection) row('Důvod', rejection);

  const embedSig = async (label: string, dataUrl: string) => {
    const img = await embedDataUrlImage(pdfDoc, dataUrl);
    if (!img) return;
    y -= 6;
    page.drawText(safeText(label), { x: margin, y, size: 10, font: fontBold, color: gray });
    y -= 12;
    const targetW = 200;
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
  page.drawText(safeText('V Praze, v sídle spolku Pupen, z. s.'), { x: margin, y: 60, size: 9, font, color: gray });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
