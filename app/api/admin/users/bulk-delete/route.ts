import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { profile, user } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    if (ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });

    const supabase = getServerSupabase();

    // Prevent deleting self
    const filteredIds = ids.filter((id: any) => id !== user.id);

    for (const targetId of filteredIds) {
      const delAuth = await supabase.auth.admin.deleteUser(targetId);
      if (delAuth.error) {
        console.error(`Failed to delete user ${targetId}:`, delAuth.error);
      } else {
        try {
          await supabase.from('profiles').delete().eq('id', targetId);
        } catch {}
      }
    }

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: (profile as any)?.first_name || 'admin',
      action: 'USERS_BULK_DELETE',
      details: { deleted_count: filteredIds.length, target_ids: filteredIds }
    }]);

    return NextResponse.json({ ok: true, deleted: filteredIds.length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}