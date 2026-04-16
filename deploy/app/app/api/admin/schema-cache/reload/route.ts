import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function isMissingRpcFunction(e: any, fn: string) {
  const msg = String(e?.message || '');
  return msg.includes('Could not find the function') && msg.includes(fn);
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const { error } = await supabase.rpc('admin_reload_schema_cache');
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isMissingRpcFunction(e, 'admin_reload_schema_cache')) {
      return NextResponse.json(
        {
          error:
            "Chybí DB funkce pro reload schema cache. Aplikujte migraci `migrace/33_admin_schema_cache_tools.sql`, nebo v Supabase Dashboard → Settings → API → Restart API.",
        },
        { status: 501 },
      );
    }
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
