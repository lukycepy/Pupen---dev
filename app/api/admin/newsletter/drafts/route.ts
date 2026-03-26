import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_drafts')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ drafts: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { subject, body_html, target_categories } = body;

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_drafts')
      .insert([{ 
        subject: subject || 'Bez předmětu', 
        body_html: body_html || '', 
        target_categories: target_categories || ['all'],
        created_by: user.id
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
