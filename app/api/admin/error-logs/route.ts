import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const supabase = getServerSupabase();
    const { user } = await requireAdmin(req);
    const profRes = await supabase
      .from('profiles')
      .select('can_manage_admins, can_view_logs, can_edit_logs')
      .eq('id', user.id)
      .maybeSingle();
    if (profRes.error) throw profRes.error;
    const profile = profRes.data as any;
    const canView = !!(profile?.can_manage_admins || profile?.can_view_logs || profile?.can_edit_logs);
    if (!canView) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { data, error } = await supabase
      .from('error_logs')
      .select('*, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ logs: data });
  } catch (error: any) {
    console.error('GET error_logs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = getServerSupabase();
    const { user } = await requireAdmin(req);
    const profRes = await supabase
      .from('profiles')
      .select('can_manage_admins, can_edit_logs')
      .eq('id', user.id)
      .maybeSingle();
    if (profRes.error) throw profRes.error;
    const profile = profRes.data as any;
    const canEdit = !!(profile?.can_manage_admins || profile?.can_edit_logs);
    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { error } = await supabase
      .from('error_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE error_logs error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
