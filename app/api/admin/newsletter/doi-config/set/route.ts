import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { normalizeNewsletterDoiConfig } from '@/lib/newsletter/doiConfig';

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const config = normalizeNewsletterDoiConfig(body?.config);

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Newsletter',
        action: 'NEWSLETTER_DOI_CONFIG',
        target_id: null,
        details: { config, updatedAt: new Date().toISOString() },
      },
    ]);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

