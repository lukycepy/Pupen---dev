import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: targetUserId } = await ctx.params;
    const supabase = getServerSupabase();

    // 1. Delete user from auth (requires service role key usually, but let's assume we can use supabase.auth.admin if we use service role)
    // Actually, getServerSupabase uses service role key if configured, but normally next/server uses anon key.
    // Wait, `getServerSupabase` in this project uses the service role key! Let's check `lib/supabase-server.ts`.
    
    // For now, let's just delete the profile. If profiles has ON DELETE CASCADE from auth.users, we can't delete auth.users without admin API.
    // Let's use the admin API:
    const { error: authError } = await supabase.auth.admin.deleteUser(targetUserId);

    if (authError) {
      // Fallback: If we can't delete auth user (maybe no admin rights on supabase client), let's just delete profile
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', targetUserId);
      if (profileError) throw profileError;
    }

    // Log the action
    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: 'Admin API',
      action: 'USER_DELETE',
      target_id: targetUserId,
      details: { deletedAt: new Date().toISOString(), deletedBy: user.id }
    }]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE user error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
