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

    const { error } = await supabase
      .from('applications')
      .update({ status: 'approved', decided_at: new Date().toISOString(), decided_by_email: user.email })
      .in('id', ids);

    if (error) throw error;

    // Log the action
    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: 'Admin API',
      action: 'APPLICATIONS_BULK_APPROVE',
      target_id: 'bulk',
      details: { ids, approvedBy: user.id }
    }]);

    // Odesílání schvalovacích emailů (může trvat, v praxi by se mělo hodit do queue)
    // Pro zjednodušení teď jen nastavíme status a emaily by měly odejít asynchronně nebo cronem,
    // nebo zavoláme status-email endpoint pro každý z nich asynchronně.
    ids.forEach((id: string) => {
      fetch(new URL('/api/admin/applications/status-email', req.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('cookie') || ''
        },
        body: JSON.stringify({ applicationId: id, status: 'approved' })
      }).catch(console.error);
    });

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error: any) {
    console.error('BULK APPROVE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
