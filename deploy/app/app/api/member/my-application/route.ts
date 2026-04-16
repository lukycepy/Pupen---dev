import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) return NextResponse.json({ ok: true, application: null });

    const supabase = getServerSupabase();
    const res = await supabase
      .from('applications')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, application: (res.data || [])[0] || null });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

