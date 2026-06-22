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

    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const anonymizedEmail = `anonymized_${randomSuffix}@deleted.pupen.org`;

    // 1. Update auth.users (if possible)
    const { error: authError } = await supabase.auth.admin.updateUserById(targetUserId, {
      email: anonymizedEmail,
      user_metadata: { name: 'Smazaný uživatel' }
    });

    if (authError) {
      try {
        await supabase.from('admin_logs').insert([{
          admin_email: user.email || 'admin',
          admin_name: 'Admin API',
          action: 'USER_ANONYMIZE_AUTH_UPDATE_FAILED',
          target_id: targetUserId,
          details: { error: getErrorMessage(authError) }
        }]);
      } catch {}
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        email: anonymizedEmail,
        first_name: 'Smazaný',
        last_name: 'uživatel',
        display_name: 'Smazaný uživatel',
        phone: null,
        bio: null,
        avatar_url: null,
        address_street: null,
        address_city: null,
        address_zip: null,
        address_country: null,
        university_email: null,
        student_id: null,
        birth_date: null
      })
      .eq('id', targetUserId);

    if (profileError) throw profileError;

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: 'Admin API',
      action: 'USER_ANONYMIZE',
      target_id: targetUserId,
      details: { anonymizedAt: new Date().toISOString(), anonymizedBy: user.id }
    }]);

    return NextResponse.json({ success: true, email: anonymizedEmail });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
