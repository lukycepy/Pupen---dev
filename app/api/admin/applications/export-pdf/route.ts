import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildApplicationPdfBytes } from '@/lib/applications/pdf';
import { formatApplicationPdfFileName } from '@/lib/applications/pdfFilename';

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

    const { utf8, ascii } = formatApplicationPdfFileName({ firstName: app?.first_name, lastName: app?.last_name, createdAt: app?.created_at });
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(utf8)}`,
      },
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
