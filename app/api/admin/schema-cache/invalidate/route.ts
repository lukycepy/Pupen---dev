import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function isMissingRpcFunction(error: unknown, fn: string) {
  const msg = getErrorMessage(error);
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
  } catch (error: unknown) {
    if (isMissingRpcFunction(error, 'admin_reload_schema_cache')) {
      return NextResponse.json(
        {
          error:
            "Chybí DB funkce pro reload schema cache. Aplikujte migraci `supabase/migrations/20260414174642_33_admin_schema_cache_tools.sql`, nebo v Supabase Dashboard → Settings → API → Restart API.",
        },
        { status: 501 },
      );
    }
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
