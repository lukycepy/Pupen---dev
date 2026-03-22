import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes("Could not find the table") && msg.includes("in the schema cache");
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const { id } = await ctx.params;
    const supabase = getServerSupabase();
    const del = await supabase.from('app_roles').delete().eq('id', id);
    if (del.error) throw del.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'ROLE_DELETE',
          target_id: String(id),
          details: {},
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) {
      return NextResponse.json(
        {
          error:
            "Role nejsou v DB vytvořené. Spusť migraci `supabase/migrations/26_app_roles.sql` v Supabase (SQL editor / migrations) a případně restartuj API, aby se obnovil schema cache.",
        },
        { status: 501 },
      );
    }
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
