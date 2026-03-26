import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `gdpr_export_pdf:${user.id}:${ip}`, windowMs: 60 * 60 * 1000, max: 5 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const supabase = getServerSupabase();
    const email = String(user.email || '').toLowerCase();

    const profileRes = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    const profile = profileRes.data || {};

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
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
      const safeText = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9\s.,@:\-_/()\[\]]/g, '?');
      page.drawText(safeText, {
        x: margin,
        y,
        size,
        font: isBold ? fontBold : font,
        color: rgb(0, 0, 0),
      });
      y -= (size + 10);
    };

    drawText('GDPR Vypis Dat (Pupen)', 20, true);
    y -= 20;

    drawText('ZAKLADNI UDAJE PROFILU', 14, true);
    drawText(`ID uzivatele: ${user.id}`);
    drawText(`Email: ${user.email}`);
    drawText(`Jmeno: ${profile.first_name || '-'} ${profile.last_name || '-'}`);
    drawText(`Telefon: ${profile.phone || '-'}`);
    drawText(`Vytvoreno: ${new Date(profile.created_at || user.created_at || Date.now()).toLocaleString('cs-CZ')}`);
    y -= 10;

    drawText('ROLE A ODLISENI', 14, true);
    drawText(`Je admin: ${profile.is_admin ? 'Ano' : 'Ne'}`);
    drawText(`Clenske cislo: ${profile.member_number || '-'}`);
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