import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { getPdfFonts } from '@/lib/pdf/fonts';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

function fmt(value: any) {
  try {
    return new Date(String(value)).toLocaleString();
  } catch {
    return '';
  }
}

function redactName(first: string, last: string) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  const fi = f ? `${f[0]}.` : '';
  const li = l ? `${l[0]}.` : '';
  const out = `${fi} ${li}`.trim();
  return out || '—';
}

function redactEmail(email: string) {
  const v = String(email || '').trim().toLowerCase();
  const m = v.match(/^([^@]+)@(.+)$/);
  if (!m) return '—';
  const local = m[1] || '';
  const domain = m[2] || '';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    const canViewPii = auth.canViewPii;
    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();

    const thrRes = await supabase
      .from('trust_box_threads')
      .select('id,status,priority,category,subject,allow_followup,allow_forward_to_faculty,created_at,last_activity_at,anonymized_at')
      .eq('id', threadId)
      .maybeSingle();
    if (thrRes.error) throw thrRes.error;
    const thread: any = thrRes.data;
    if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const identRes = await supabase
      .from('trust_box_identities')
      .select('first_name,last_name,email')
      .eq('thread_id', threadId)
      .maybeSingle();
    if (identRes.error) throw identRes.error;
    const ident: any = identRes.data;

    const reporter = ident
      ? canViewPii
        ? { name: `${ident.first_name} ${ident.last_name}`.trim(), email: ident.email }
        : { name: redactName(ident.first_name, ident.last_name), email: redactEmail(ident.email) }
      : { name: '—', email: '—' };

    const msgsRes = await supabase
      .from('trust_box_messages')
      .select('author_type,body,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (msgsRes.error) throw msgsRes.error;
    const messages: any[] = msgsRes.data || [];

    const atRes = await supabase
      .from('trust_box_attachments')
      .select('original_name,content_type,size_bytes,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (atRes.error) throw atRes.error;
    const attachments: any[] = atRes.data || [];

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { font, fontBold } = await getPdfFonts(pdfDoc);

    const margin = 40;
    let y = 800;
    const lineH = 16;
    const maxW = 595.28 - margin * 2;

    const draw = (text: string, size: number, weight: 'normal' | 'bold' = 'normal', color = rgb(0.1, 0.1, 0.1)) => {
      const f = weight === 'bold' ? fontBold : font;
      page.drawText(text, { x: margin, y, size, font: f, color, maxWidth: maxW });
      y -= Math.max(lineH, size + 6);
    };

    const drawWrap = (label: string, value: string) => {
      const f = font;
      const labelText = `${label}: `;
      const full = `${labelText}${value}`;
      const words = full.split(/\s+/);
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        const width = f.widthOfTextAtSize(test, 11);
        if (width > maxW) {
          page.drawText(line, { x: margin, y, size: 11, font: f, color: rgb(0.15, 0.15, 0.15) });
          y -= 14;
          line = w;
        } else {
          line = test;
        }
      }
      if (line) {
        page.drawText(line, { x: margin, y, size: 11, font: f, color: rgb(0.15, 0.15, 0.15) });
        y -= 16;
      }
    };

    draw('Schránka důvěry – export', 18, 'bold', rgb(0.09, 0.6, 0.3));
    drawWrap('ID', String(thread.id));
    drawWrap('Předmět', String(thread.subject));
    drawWrap('Kategorie', String(thread.category));
    drawWrap('Status', String(thread.status));
    drawWrap('Priorita', String(thread.priority));
    drawWrap('Vytvořeno', fmt(thread.created_at));
    drawWrap('Poslední aktivita', fmt(thread.last_activity_at));
    drawWrap('Reporter', `${reporter.name} · ${reporter.email}`);
    if (thread.anonymized_at) drawWrap('Anonymizováno', fmt(thread.anonymized_at));

    y -= 10;
    draw('Zprávy', 14, 'bold');
    for (const m of messages) {
      if (y < 120) break;
      drawWrap(`${String(m.author_type || '')} (${fmt(m.created_at)})`, String(m.body || '').slice(0, 6000));
      y -= 6;
    }

    if (y > 120) {
      draw('Přílohy', 14, 'bold');
      if (attachments.length === 0) {
        drawWrap('—', 'Žádné');
      } else {
        for (const a of attachments.slice(0, 30)) {
          if (y < 120) break;
          drawWrap('Soubor', `${String(a.original_name || '')} · ${String(a.content_type || '')} · ${Number(a.size_bytes || 0)} B`);
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    const fileName = `trustbox_${threadId}.pdf`;
    await logTrustBoxAudit({
      req,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email || null,
      action: 'ADMIN_EXPORT_PDF',
      threadId,
      piiAccessed: canViewPii,
    });
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
