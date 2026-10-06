import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { withSchemaCacheRetry } from '@/lib/schema-cache-retry';

function isSchemaCacheMissingTable(error: unknown) {
  const msg = error instanceof Error ? error.message : '';
  return msg.includes("Could not find the table") && msg.includes("in the schema cache");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) throw new Error('Forbidden');
    const { id } = await ctx.params;
    const supabase = getServerSupabase();
    const del = await withSchemaCacheRetry(supabase, () => supabase.from('app_roles').delete().eq('id', id));
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
  } catch (error: unknown) {
    if (isSchemaCacheMissingTable(error)) {
      return NextResponse.json(
        {
          error:
            "Role nejsou v DB vytvořené. Spusť migraci `supabase/migrations/20260414174635_26_app_roles.sql` v Supabase (SQL editor) a případně restartuj API, aby se obnovil schema cache.",
        },
        { status: 501 },
      );
    }
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
