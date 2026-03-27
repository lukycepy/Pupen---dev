import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildApplicationPdfBytes } from '@/lib/applications/pdf';

function asciiFileName(input: string) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function contentDispositionAttachment(fileNameUtf8: string) {
  const ascii = asciiFileName(fileNameUtf8) || 'prihlaska.pdf';
  const encoded = encodeURIComponent(fileNameUtf8).replace(/'/g, '%27').replace(/\*/g, '%2A');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

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

    const pdfBytes = await buildApplicationPdfBytes(app);

    const rawName = `prihlaska_${String(app.last_name || '').trim() || 'neznamy'}_${String(app.first_name || '').trim() || 'clen'}.pdf`;
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionAttachment(rawName),
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
