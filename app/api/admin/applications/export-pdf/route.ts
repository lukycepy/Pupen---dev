import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const supabase = getServerSupabase();
    const { data: app, error } = await supabase.from('applications').select('*').eq('id', id).single();
    if (error || !app) throw error || new Error('Not found');

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    let y = 800;
    const margin = 50;

    const drawText = (text: string, size = 12, isBold = false) => {
      // Very basic non-ascii strip for Helvetica
      const safeText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s.,@:-_]/g, '?');
      page.drawText(safeText, {
        x: margin,
        y,
        size,
        font: isBold ? fontBold : font,
        color: rgb(0, 0, 0),
      });
      y -= (size + 10);
    };

    drawText('Prihlaska za clena spolku Pupen', 20, true);
    y -= 20;

    drawText('OSOBNI UDAJE', 14, true);
    drawText(`Jmeno: ${String(app.first_name || '').trim()} ${String(app.last_name || '').trim()}`.trim());
    drawText(`Email: ${app.email || '-'}`);
    drawText(`Univerzitni email: ${app.university_email || '-'}`);
    drawText(`Telefon: ${app.phone || '-'}`);
    drawText(`Rocnik: ${app.study_year || '-'}, Obor: ${app.field_of_study || '-'}`);
    y -= 10;

    drawText('ADRESA', 14, true);
    drawText(`Adresa: ${app.address || '-'}`);
    y -= 10;

    drawText('O ZADATELOVI', 14, true);
    drawText(`Motivace: ${app.motivation || '-'}`);
    y -= 10;

    drawText('STAV', 14, true);
    drawText(`Status: ${app.status}`);
    drawText(`Podano: ${new Date(app.created_at).toLocaleString('cs-CZ')}`);
    if (app.decided_at) drawText(`Rozhodnuto: ${new Date(app.decided_at).toLocaleString('cs-CZ')}`);
    if (app.decided_by_email) drawText(`Rozhodl: ${app.decided_by_email}`);
    if (app.status === 'rejected' && (app.rejection_reason || app.decision_reason)) {
      drawText(`Duvod: ${app.rejection_reason || app.decision_reason}`);
    }

    if (app.applicant_signature) {
      y -= 20;
      drawText('PODPIS ZADATELE', 14, true);
      try {
        const sigImageBytes = Buffer.from(app.applicant_signature.split(',')[1], 'base64');
        const image = await pdfDoc.embedPng(sigImageBytes);
        const { width, height } = image.scale(0.5);
        page.drawImage(image, {
          x: margin,
          y: y - height,
          width,
          height,
        });
        y -= (height + 20);
      } catch (e) {
        drawText('(Chyba pri nacteni podpisu)');
      }
    }

    if (app.chairwoman_signature) {
      y -= 20;
      drawText('PODPIS PREDSEDY', 14, true);
      try {
        const sigImageBytes = Buffer.from(app.chairwoman_signature.split(',')[1], 'base64');
        const image = await pdfDoc.embedPng(sigImageBytes);
        const { width, height } = image.scale(0.5);
        page.drawImage(image, {
          x: margin,
          y: y - height,
          width,
          height,
        });
        y -= (height + 20);
      } catch (e) {
        drawText('(Chyba pri nacteni podpisu)');
      }
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="prihlaska_${String(app.last_name || '').trim() || 'neznamy'}_${String(app.first_name || '').trim() || 'clen'}.pdf"`,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
