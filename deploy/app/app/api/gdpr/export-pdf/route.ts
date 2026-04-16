import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';
import { guardPublicGet } from '@/lib/public-post-guard';
import { PDFDocument, rgb } from 'pdf-lib';
import { getPdfFonts } from '@/lib/pdf/fonts';

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

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const g = await guardPublicGet(req, {
      keyPrefix: `gdpr_export_pdf:${user.id}`,
      windowMs: 60 * 60 * 1000,
      max: 5,
      tooManyMessage: 'Příliš mnoho požadavků. Zkuste to prosím později.',
    });
    if (!g.ok) return g.response;

    const supabase = getServerSupabase();

    const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    const profile = profileRes.data || {};

    const pdfDoc = await PDFDocument.create();
    const { font, fontBold } = await getPdfFonts(pdfDoc);
    let page = pdfDoc.addPage([595.28, 841.89]);

    const width = 595.28;
    const margin = 48;
    let y = 800;

    const black = rgb(0, 0, 0);
    const gray = rgb(0.35, 0.35, 0.35);
    const light = rgb(0.92, 0.92, 0.92);
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

    const newPage = () => {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 800;
      page.drawRectangle({ x: 0, y: 835, width, height: 6, color: green });
    };

    page.drawRectangle({ x: 0, y: 835, width, height: 6, color: green });
    page.drawRectangle({ x: margin, y: 748, width: width - margin * 2, height: 78, color: paper, borderColor: light, borderWidth: 1 });
    drawSafe('GDPR VÝPIS DAT', { x: margin, y, size: 20, font: fontBold, color: black });
    y -= 24;
    drawSafe('Studentský spolek Pupen, z.s.', { x: margin, y, size: 10, font: fontBold, color: gray });
    y -= 14;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
    y -= 18;

    const section = (title: string) => {
      if (y < 120) newPage();
      drawSafe(title, { x: margin, y, size: 11, font: fontBold, color: green });
      y -= 10;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
      y -= 14;
    };

    const row = (label: string, value: any) => {
      if (y < 120) newPage();
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

    const createdAt = profile.created_at || user.created_at || Date.now();
    section('ZÁKLADNÍ ÚDAJE');
    row('ID uživatele', user.id);
    row('Email', user.email || '-');
    row('Jméno', `${cleanText(profile.first_name, '-') } ${cleanText(profile.last_name, '-') }`.trim());
    row('Telefon', profile.phone || '-');
    row('Vytvořeno', new Date(createdAt).toLocaleString('cs-CZ'));

    section('ROLE A ODLIŠENÍ');
    row('Je admin', profile.is_admin ? 'Ano' : 'Ne');
    row('Členské číslo', profile.member_number || '-');

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'system',
          admin_name: 'GDPR Export PDF',
          action: 'EXPORT_DOWNLOAD',
          target_id: user.id,
          details: { format: 'pdf', type: 'gdpr_summary', exportedBy: user.id },
        },
      ]);
    } catch {}

    const pdfBytes = await pdfDoc.save();

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="pupen_gdpr_export_${date}.pdf"`,
      },
    });

  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
