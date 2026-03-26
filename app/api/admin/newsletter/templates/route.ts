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
      .from('newsletter_templates')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ templates: data });
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
    const { name, subject, body_html } = body;

    if (!name || !subject || !body_html) {
      return NextResponse.json({ error: 'Name, subject and body_html are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_templates')
      .insert([{ 
        name, 
        subject, 
        body_html,
        created_by: user.id
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
