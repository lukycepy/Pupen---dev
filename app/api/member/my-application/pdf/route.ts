import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { buildApplicationPdfBytes } from '@/lib/applications/pdf';

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

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="prihlaska_${last}_${first}.pdf"`,
      },
    });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

