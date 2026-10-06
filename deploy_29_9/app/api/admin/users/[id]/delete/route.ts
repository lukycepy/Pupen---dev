import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: targetUserId } = await ctx.params;
    const supabase = getServerSupabase();

    const { error: authError } = await supabase.auth.admin.deleteUser(targetUserId);

    if (authError) {
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', targetUserId);
      if (profileError) throw profileError;
    }

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: 'Admin API',
      action: 'USER_DELETE',
      target_id: targetUserId,
      details: { deletedAt: new Date().toISOString(), deletedBy: user.id }
    }]);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
