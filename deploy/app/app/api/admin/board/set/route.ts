import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const roles = Array.isArray(body?.roles) ? body.roles : [];

    const normalized = roles
      .map((r: any) => ({
        role: String(r?.role || '').trim(),
        name: String(r?.name || '').trim(),
        email: String(r?.email || '').trim(),
        note: r?.note ? String(r.note).trim() : '',
      }))
      .filter((r: any) => r.role && (r.name || r.email))
      .slice(0, 30);

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Board',
        action: 'BOARD_DIRECTORY',
        target_id: null,
        details: { roles: normalized, updatedAt: new Date().toISOString() },
      },
    ]);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

