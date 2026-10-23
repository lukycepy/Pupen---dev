import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildApplicationPdfBytes } from '@/lib/applications/pdf';
import { verifySignedToken } from '@/lib/signed-token';
import { formatApplicationPdfFileName } from '@/lib/applications/pdfFilename';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const token = String(searchParams.get('t') || '').trim();
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const secret = process.env.APPLICATION_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!secret) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

    const v = verifySignedToken(token, secret);
    if (!v.ok) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });

    const appId = String(v.payload?.appId || '').trim();
    const email = String(v.payload?.email || '').trim().toLowerCase();
    const exp = Number(v.payload?.exp || 0);
    if (!appId || !email || !Number.isFinite(exp)) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (Date.now() > exp) return NextResponse.json({ error: 'Token expired' }, { status: 410 });

    const supabase = getServerSupabase();
    const { data: app, error } = await supabase.from('applications').select('*').eq('id', appId).maybeSingle();
    if (error) throw error;
    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const appEmail = String(app?.email || '').trim().toLowerCase();
    if (appEmail !== email) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const bytes = await buildApplicationPdfBytes(app);
    const { utf8, ascii } = formatApplicationPdfFileName({ firstName: app?.first_name, lastName: app?.last_name, createdAt: app?.created_at });

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || 'Error') }, { status: 500 });
  }
}

