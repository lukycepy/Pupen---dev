import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('user_badges')
      .select('*, gamification_badges(*)')
      .eq('user_id', user.id)
      .order('awarded_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ badges: data });
  } catch (error: any) {
    console.error('GET user badges error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
