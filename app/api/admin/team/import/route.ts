import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function POST(req: Request) {
  try {
    const { profile, user } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ error: 'Žádná data k importu' }, { status: 400 });

    const supabase = getServerSupabase();
    
    // Očekávané sloupce v CSV: name, role, bio, email, phone, social_linkedin, sort_order
    const inserts = rows.map((row: any, i: number) => ({
      name: String(row.name || '').trim(),
      role: String(row.role || '').trim(),
      bio: String(row.bio || '').trim(),
      email: row.email ? String(row.email).trim() : null,
      phone: row.phone ? String(row.phone).trim() : null,
      social_linkedin: row.social_linkedin ? String(row.social_linkedin).trim() : null,
      sort_order: parseInt(row.sort_order) || (i + 1) * 10,
      is_active: true
    })).filter((x: any) => x.name && x.role);

    if (!inserts.length) return NextResponse.json({ error: 'Žádné validní záznamy v CSV (chybí name nebo role)' }, { status: 400 });

    const { error } = await supabase.from('team_members').insert(inserts).select();
    if (error) throw error;

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: user.user_metadata?.full_name || 'admin',
      action: 'TEAM_CSV_IMPORT',
      details: { imported_count: inserts.length }
    }]);

    return NextResponse.json({ ok: true, imported: inserts.length });
  } catch (error: any) {
    const msg = String(error?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
