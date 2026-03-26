import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { ids } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    // V této implementaci předpokládáme, že existuje sloupec status v tabulce přihlášek,
    // a nastavíme ho na 'rejected'.
    const { error } = await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .in('id', ids);

    if (error) throw error;

    // Log the action
    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: 'Admin API',
      action: 'APPLICATIONS_BULK_REJECT',
      target_id: 'bulk',
      details: { ids, rejectedBy: user.id }
    }]);

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error: any) {
    console.error('BULK REJECT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
