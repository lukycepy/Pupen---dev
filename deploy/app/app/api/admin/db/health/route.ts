import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

const CRITICAL_TABLES = [
  'profiles',
  'admin_logs',
  'site_public_config',
  'app_roles',
  'app_user_roles',
  'member_documents',
  'email_send_queue',
  'email_audit_logs',
  'trust_box_settings',
  'trust_box_threads',
  'trust_box_admins',
];

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const { data, error } = await supabase.rpc('admin_schema_health', { table_names: CRITICAL_TABLES });

    if (!error && data) {
      return NextResponse.json({ ok: true, mode: 'rpc', health: data }, { status: 200 });
    }

    const checks = await Promise.all(
      CRITICAL_TABLES.map(async (t) => {
        const q = await supabase.rpc('admin_to_regclass', { name: `public.${t}` });
        return { table: t, exists: !!q.data };
      }),
    );

    return NextResponse.json(
      {
        ok: true,
        mode: 'fallback',
        tables: checks,
        missing: checks.filter((c) => !c.exists).map((c) => c.table),
      },
      { status: 200 },
    );
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

