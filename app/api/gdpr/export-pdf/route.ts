import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';
import { guardPublicGet } from '@/lib/public-post-guard';
import { PDFDocument, rgb } from 'pdf-lib';
import { getPdfFonts } from '@/lib/pdf/fonts';

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
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { font, fontBold } = await getPdfFonts(pdfDoc);
    
    let y = 800;
    const margin = 50;

    const checkNewPage = (neededSpace: number) => {
      if (y - neededSpace < margin) {
        page = pdfDoc.addPage([595.28, 841.89]);
        y = 800;
      }
    };

    const drawText = (text: string, size = 12, isBold = false) => {
      checkNewPage(size + 10);
      const draw = (t: string) =>
        page.drawText(t, {
          x: margin,
          y,
          size,
          font: isBold ? fontBold : font,
          color: rgb(0, 0, 0),
        });
      try {
        draw(text);
      } catch {
        draw(String(text || ''));
      }
      y -= (size + 10);
    };

    drawText('Studentský spolek Pupen, z.s.', 12, true);
    drawText('GDPR výpis dat', 20, true);
    y -= 20;

    drawText('ZÁKLADNÍ ÚDAJE PROFILU', 14, true);
    drawText(`ID uživatele: ${user.id}`);
    drawText(`Email: ${user.email}`);
    drawText(`Jméno: ${profile.first_name || '-'} ${profile.last_name || '-'}`);
    drawText(`Telefon: ${profile.phone || '-'}`);
    drawText(`Vytvořeno: ${new Date(profile.created_at || user.created_at || Date.now()).toLocaleString('cs-CZ')}`);
    y -= 10;

    drawText('ROLE A ODLIŠENÍ', 14, true);
    drawText(`Je admin: ${profile.is_admin ? 'Ano' : 'Ne'}`);
    drawText(`Členské číslo: ${profile.member_number || '-'}`);
    y -= 10;

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'system',
      admin_name: 'GDPR Export PDF',
      action: 'EXPORT_DOWNLOAD',
      target_id: user.id,
      details: { format: 'pdf', type: 'gdpr_summary', exportedBy: user.id }
    }]);

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
