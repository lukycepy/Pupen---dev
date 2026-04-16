import { NextResponse } from 'next/server';
import { PDFDocument, rgb } from 'pdf-lib';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { getPdfFonts } from '@/lib/pdf/fonts';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

function cleanText(input: any, fallback = '—') {
  const s = String(input ?? '').replace(/\u0000/g, '').trim();
  if (!s) return fallback;
  return s.replace(/\s+/g, ' ').trim();
}

function asciiFallbackText(input: any, fallback = '—') {
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
    const isSuperadmin = auth.isSuperadmin;
    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const url = new URL(req.url);
    const includePii = url.searchParams.get('include_pii') === '1';
    const reason = String(url.searchParams.get('reason') || '').trim();
    const piiAllowed = includePii && isSuperadmin;
    if (includePii && !piiAllowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (piiAllowed && reason.length < 10) return NextResponse.json({ error: 'Reason required' }, { status: 400 });

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
      ? piiAllowed && !thread.anonymized_at
        ? { name: `${ident.first_name} ${ident.last_name}`.trim(), email: ident.email }
        : { name: redactName(ident.first_name, ident.last_name), email: redactEmail(ident.email) }
      : { name: '—', email: '—' };

    const msgsRes = await supabase
      .from('trust_box_messages')
      .select('author_type,author_name,body,created_at')
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
    const { font, fontBold } = await getPdfFonts(pdfDoc);

    const width = 595.28;
    const margin = 48;
    const black = rgb(0, 0, 0);
    const gray = rgb(0.35, 0.35, 0.35);
    const light = rgb(0.92, 0.92, 0.92);
    const green = rgb(0.08, 0.6, 0.26);
    const paper = rgb(0.98, 0.98, 0.97);

    let page = pdfDoc.addPage([width, 841.89]);
    let y = 800;

    const drawSafe = (text: any, opts: { x: number; y: number; size: number; font: any; color: any }) => {
      const primary = cleanText(text, '');
      if (!primary) return;
      try {
        page.drawText(primary, opts);
      } catch {
        page.drawText(asciiFallbackText(primary, ''), opts);
      }
    };

    const header = () => {
      page.drawRectangle({ x: 0, y: 835, width, height: 6, color: green });
      page.drawRectangle({ x: margin, y: 748, width: width - margin * 2, height: 78, color: paper, borderColor: light, borderWidth: 1 });
      drawSafe('SCHRÁNKA DŮVĚRY', { x: margin, y, size: 10, font: fontBold, color: gray });
      y -= 16;
      drawSafe('Export vlákna', { x: margin, y, size: 20, font: fontBold, color: black });
      y -= 18;
      page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: light });
      y -= 18;
    };

    const newPage = () => {
      page = pdfDoc.addPage([width, 841.89]);
      y = 800;
      header();
    };

    header();

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
      const rawValue = cleanText(value, '—');
      const valueLines = wrapLines(font, rawValue, 11, valueWidth);
      for (let i = 0; i < valueLines.length; i += 1) {
        drawSafe(valueLines[i], { x: valueX, y: y - i * 14, size: 11, font, color: black });
      }
      y -= Math.max(16, valueLines.length * 14);
    };

    section('METADATA');
    row('ID', String(thread.id));
    row('Předmět', thread.subject || '—');
    row('Kategorie', thread.category || '—');
    row('Status', thread.status || '—');
    row('Priorita', thread.priority || '—');
    row('Vytvořeno', fmt(thread.created_at));
    row('Poslední aktivita', fmt(thread.last_activity_at));
    row('Reporter', `${reporter.name} · ${reporter.email}`);
    if (thread.anonymized_at) row('Anonymizováno', fmt(thread.anonymized_at));

    section('ZPRÁVY');
    for (const m of messages) {
      const body = String(m.body || '').slice(0, 6000);
      const who =
        String(m.author_type || '').toLowerCase() === 'reporter'
          ? 'reporter'
          : String(m.author_type || '').toLowerCase() === 'internal'
            ? `internal${m.author_name ? ` (${String(m.author_name)})` : ''}`
            : `admin${m.author_name ? ` (${String(m.author_name)})` : ''}`;

      const head = `${who} · ${fmt(m.created_at)}`;
      if (y < 150) newPage();
      drawSafe(head, { x: margin, y, size: 9, font: fontBold, color: gray });
      y -= 14;
      const lines = wrapLines(font, cleanText(body, '—'), 11, width - margin * 2);
      for (const line of lines) {
        if (y < 90) newPage();
        drawSafe(line, { x: margin, y, size: 11, font, color: black });
        y -= 14;
      }
      y -= 8;
    }

    section('PŘÍLOHY');
    if (attachments.length === 0) {
      row('—', 'Žádné');
    } else {
      for (const a of attachments.slice(0, 60)) {
        if (y < 120) newPage();
        const name = String(a.original_name || '');
        const ct = String(a.content_type || '');
        const size = Number(a.size_bytes || 0);
        row('Soubor', `${name} · ${ct} · ${size} B`);
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
      piiAccessed: piiAllowed,
      reason: piiAllowed ? reason : undefined,
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
