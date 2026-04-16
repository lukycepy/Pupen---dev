import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildApplicationPdfBytes } from '@/lib/applications/pdf';
import { formatApplicationPdfFileName } from '@/lib/applications/pdfFilename';

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
    const { utf8, ascii } = formatApplicationPdfFileName({ firstName: app?.first_name, lastName: app?.last_name, createdAt: app?.created_at });

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`,
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
