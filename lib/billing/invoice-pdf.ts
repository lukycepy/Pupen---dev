import { PDFDocument, rgb } from 'pdf-lib';
import { getPdfFonts } from '@/lib/pdf/fonts';
import { formatDatePrague } from '@/lib/time/prague';

export const BILLING_INVOICE_PDF_BUCKET = 'billing_invoices';
const LOGO_PNG_URL = new URL('../../public/logo.png', import.meta.url);

function cleanText(input: any, fallback = '-') {
  const s = String(input ?? '').replace(/\u0000/g, '').trim();
  if (!s) return fallback;
  return s.replace(/\s+/g, ' ').trim();
}

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

function formatMoney(value: any, currency: string) {
  const v = typeof value === 'number' ? value : Number(value || 0);
  try {
    return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: currency || 'CZK', maximumFractionDigits: 2 }).format(v || 0);
  } catch {
    return `${v || 0} ${currency || 'CZK'}`;
  }
}

function labelType(type: any) {
  const t = String(type || '').trim().toLowerCase();
  if (t === 'deposit') return 'Zálohová faktura';
  if (t === 'credit_note') return 'Dobropis';
  return 'Faktura';
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

async function loadLogoPngBytes(): Promise<Uint8Array | null> {
  try {
    const fs = await import('node:fs/promises');
    const buf = await fs.readFile(LOGO_PNG_URL);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function parseYear(invoice: any) {
  const num = String(invoice?.number || '').trim();
  const m = num.match(/-(\d{4})-/);
  if (m?.[1]) return m[1];
  const issue = String(invoice?.issue_date || invoice?.issueDate || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(issue)) return issue.slice(0, 4);
  return String(new Date().getFullYear());
}

function sanitizeFileBase(input: string) {
  return String(input || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

export function buildBillingInvoicePdfStoragePath(invoice: any) {
  const base = sanitizeFileBase(String(invoice?.number || invoice?.id || 'invoice'));
  const year = parseYear(invoice);
  return `${year}/${base || 'invoice'}.pdf`;
}

export async function buildBillingInvoicePdfBytes(input: { invoice: any; items: any[] }) {
  const invoice = input.invoice || {};
  const items = Array.isArray(input.items) ? input.items : [];

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { font, fontBold } = await getPdfFonts(pdfDoc);

  const width = 595.28;
  const margin = 48;
  let y = 800;

  const black = rgb(0, 0, 0);
  const gray = rgb(0.35, 0.35, 0.35);
  const light = rgb(0.9, 0.9, 0.9);
  const green = rgb(0.08, 0.6, 0.26);
  const paper = rgb(0.98, 0.98, 0.97);

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
      const targetW = 52;
      const s = targetW / logo.width;
      const targetH = logo.height * s;
      page.drawImage(logo, { x: margin, y: y - 10, width: targetW, height: targetH });
    } catch {}
  }

  page.drawRectangle({ x: 0, y: 835, width, height: 6, color: green });
  page.drawRectangle({ x: margin, y: 748, width: width - margin * 2, height: 78, color: paper, borderColor: light, borderWidth: 1 });

  drawSafe(labelType(invoice?.type).toUpperCase(), { x: margin + 70, y, size: 12, font: fontBold, color: green });
  y -= 18;
  drawSafe('PUPEN, Z.S.', { x: margin + 70, y, size: 20, font: fontBold, color: black });
  y -= 20;
  drawSafe('Studentský spolek Pupen, z.s. • Kamýcká 129, Suchdol, 165 00 Praha', { x: margin + 70, y, size: 9, font, color: gray });
  y -= 12;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
  y -= 22;

  const number = cleanText(invoice?.number, '');
  if (number) {
    drawSafe(`Číslo: ${number}`, { x: margin, y, size: 13, font: fontBold, color: black });
  } else {
    drawSafe('Číslo: —', { x: margin, y, size: 13, font: fontBold, color: black });
  }

  const issue = invoice?.issue_date || invoice?.issueDate || null;
  const due = invoice?.due_date || invoice?.dueDate || null;
  const issueLabel = issue ? formatDatePrague(issue, 'cs') : '—';
  const dueLabel = due ? formatDatePrague(due, 'cs') : '—';

  drawSafe(`Datum vystavení: ${issueLabel}`, { x: width - margin - 210, y, size: 10, font, color: gray });
  y -= 14;
  drawSafe(`Splatnost: ${dueLabel}`, { x: width - margin - 210, y, size: 10, font, color: gray });
  y -= 26;

  const buyerName = cleanText(invoice?.buyer_name ?? invoice?.buyerName, '');
  const buyerEmail = cleanText(invoice?.buyer_email ?? invoice?.buyerEmail, '');
  const buyerAddress = String(invoice?.buyer_address ?? invoice?.buyerAddress ?? '').trim();
  const ico = cleanText(invoice?.ico, '');
  const dic = cleanText(invoice?.dic, '');
  const note = String(invoice?.note || '').trim();

  page.drawRectangle({ x: margin, y: y - 84, width: width - margin * 2, height: 84, borderColor: light, borderWidth: 1, color: rgb(1, 1, 1) });
  drawSafe('Odběratel', { x: margin + 12, y: y - 18, size: 10, font: fontBold, color: gray });
  drawSafe(buyerName || '—', { x: margin + 12, y: y - 34, size: 12, font: fontBold, color: black });

  const addrLines = buyerAddress ? buyerAddress.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : [];
  const addrText = addrLines.length ? addrLines.join(', ') : '';
  const wrappedAddr = addrText ? wrapLines(font, addrText, 10, width - margin * 2 - 24) : [];
  for (let i = 0; i < Math.min(2, wrappedAddr.length); i += 1) {
    drawSafe(wrappedAddr[i], { x: margin + 12, y: y - 50 - i * 12, size: 10, font, color: black });
  }

  const rightX = width - margin - 210;
  if (buyerEmail) drawSafe(`E-mail: ${buyerEmail}`, { x: rightX, y: y - 18, size: 9, font, color: gray });
  if (ico) drawSafe(`IČO: ${ico}`, { x: rightX, y: y - 32, size: 9, font, color: gray });
  if (dic) drawSafe(`DIČ: ${dic}`, { x: rightX, y: y - 46, size: 9, font, color: gray });

  y -= 108;

  drawSafe('Položky', { x: margin, y, size: 11, font: fontBold, color: green });
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
  y -= 14;

  const colPosX = margin;
  const colTitleX = margin + 40;
  const colQtyX = width - margin - 230;
  const colUnitX = width - margin - 150;
  const colTotalX = width - margin - 60;

  drawSafe('#', { x: colPosX, y, size: 9, font: fontBold, color: gray });
  drawSafe('Popis', { x: colTitleX, y, size: 9, font: fontBold, color: gray });
  drawSafe('Ks', { x: colQtyX, y, size: 9, font: fontBold, color: gray });
  drawSafe('Cena', { x: colUnitX, y, size: 9, font: fontBold, color: gray });
  drawSafe('Celkem', { x: colTotalX, y, size: 9, font: fontBold, color: gray });
  y -= 10;
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
  y -= 14;

  const currency = cleanText(invoice?.currency, 'CZK');
  const toNum = (v: any) => (typeof v === 'number' ? v : Number(v || 0));
  const fmtNum = (v: any) => {
    const n = toNum(v);
    try {
      return new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n || 0);
    } catch {
      return String(n || 0);
    }
  };

  const tableWidth = width - margin * 2;
  const titleMaxWidth = (colQtyX - 12) - colTitleX;

  for (const it of items) {
    const pos = cleanText(it?.position, '');
    const title = cleanText(it?.title, 'Položka');
    const qty = fmtNum(it?.quantity);
    const unit = formatMoney(toNum(it?.unit_price ?? it?.unitPrice), currency);
    const lineTotal = formatMoney(toNum(it?.total), currency);
    const titleLines = wrapLines(font, title, 10, titleMaxWidth);
    const rowH = Math.max(14, titleLines.length * 12);

    if (y - rowH < 90) break;

    drawSafe(pos, { x: colPosX, y, size: 10, font, color: black });
    for (let i = 0; i < titleLines.length; i += 1) {
      drawSafe(titleLines[i], { x: colTitleX, y: y - i * 12, size: 10, font, color: black });
    }
    drawSafe(qty, { x: colQtyX, y, size: 10, font, color: black });
    drawSafe(unit, { x: colUnitX, y, size: 10, font, color: black });
    drawSafe(lineTotal, { x: colTotalX, y, size: 10, font, color: black });

    y -= rowH;
    page.drawLine({ start: { x: margin, y: y + 4 }, end: { x: width - margin, y: y + 4 }, thickness: 1, color: rgb(0.96, 0.96, 0.96) });
    y -= 6;
  }

  const total = formatMoney(invoice?.total, currency);
  page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
  y -= 18;
  drawSafe('Celkem k úhradě', { x: width - margin - 210, y, size: 11, font: fontBold, color: gray });
  drawSafe(total, { x: width - margin - 60, y, size: 12, font: fontBold, color: black });
  y -= 26;

  if (note) {
    drawSafe('Poznámka', { x: margin, y, size: 10, font: fontBold, color: gray });
    y -= 12;
    const noteLines = wrapLines(font, note.replace(/\s+/g, ' ').trim(), 10, tableWidth);
    for (let i = 0; i < Math.min(4, noteLines.length); i += 1) {
      drawSafe(noteLines[i], { x: margin, y: y - i * 12, size: 10, font, color: black });
    }
    y -= Math.min(4, noteLines.length) * 12 + 10;
  }

  drawSafe('Tento dokument byl vygenerován systémem Pupen.', { x: margin, y: 58, size: 9, font, color: gray });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
