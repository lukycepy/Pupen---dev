import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
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
    const { user } = await requireMember(req);
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase
      .from('applications')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);
    if (res.error) throw res.error;
    const app = (res.data || [])[0];
    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const pdfBytes = await buildApplicationPdfBytes(app);
    const last = String((app as any)?.last_name || '').trim() || 'neznamy';
    const first = String((app as any)?.first_name || '').trim() || 'clen';

    const rawName = `prihlaska_${last}_${first}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDispositionAttachment(rawName),
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
