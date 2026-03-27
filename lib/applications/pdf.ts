import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function buildApplicationPdfBytes(app: any) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const margin = 50;

  const drawText = (text: string, size = 12, isBold = false) => {
    const safeText = String(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s.,@:\\/-_]/g, '?');
    page.drawText(safeText, {
      x: margin,
      y,
      size,
      font: isBold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
    y -= size + 10;
  };

  drawText('Prihlaska za clena spolku Pupen', 20, true);
  y -= 20;

  drawText('OSOBNI UDAJE', 14, true);
  const firstName = String(app?.first_name || '').trim();
  const lastName = String(app?.last_name || '').trim();
  const fullName = `${firstName} ${lastName}`.trim() || String(app?.name || '').trim();
  drawText(`Jmeno: ${fullName}`.trim());
  drawText(`Email: ${app?.email || '-'}`);
  drawText(`Univerzitni email: ${app?.university_email || '-'}`);
  drawText(`Telefon: ${app?.phone || '-'}`);
  drawText(`Rocnik: ${app?.study_year || '-'}, Obor: ${app?.field_of_study || '-'}`);
  y -= 10;

  drawText('ADRESA', 14, true);
  drawText(`Adresa: ${app?.address || '-'}`);
  y -= 10;

  drawText('O ZADATELOVI', 14, true);
  drawText(`Motivace: ${app?.motivation || '-'}`);
  y -= 10;

  drawText('STAV', 14, true);
  drawText(`Status: ${app?.status || '-'}`);
  if (app?.created_at) drawText(`Podano: ${new Date(app.created_at).toLocaleString('cs-CZ')}`);
  if (app?.decided_at) drawText(`Rozhodnuto: ${new Date(app.decided_at).toLocaleString('cs-CZ')}`);
  if (app?.decided_by_email) drawText(`Rozhodl: ${app.decided_by_email}`);
  const rejection = app?.rejection_reason || app?.decision_reason;
  if (app?.status === 'rejected' && rejection) drawText(`Duvod: ${rejection}`);

  const embedSig = async (label: string, dataUrl: string) => {
    y -= 20;
    drawText(label, 14, true);
    const base64 = String(dataUrl || '').split(',')[1] || '';
    const bytes = Buffer.from(base64, 'base64');
    const image = await pdfDoc.embedPng(bytes);
    const { width, height } = image.scale(0.5);
    page.drawImage(image, { x: margin, y: y - height, width, height });
    y -= height + 20;
  };

  try {
    const s = String(app?.applicant_signature || app?.signature_data_url || '').trim();
    if (s) await embedSig('PODPIS ZADATELE', s);
  } catch {
    drawText('(Chyba pri nacteni podpisu zadatele)');
  }

  try {
    const s = String(app?.chairwoman_signature || '').trim();
    if (s) await embedSig('PODPIS PREDSEDY', s);
  } catch {
    drawText('(Chyba pri nacteni podpisu predsedky)');
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

