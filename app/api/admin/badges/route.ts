import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('gamification_badges')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ badges: data });
  } catch (error: any) {
    console.error('GET badges error:', error);
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
    const { name, description, icon, criteria, points } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('gamification_badges')
      .insert([{ name, description, icon, criteria, points: points || 0 }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ badge: data });
  } catch (error: any) {
    console.error('POST badge error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
