import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export async function GET(req: Request) {
  try {
    const { user } = await requireMember(req);
    const supabase = getServerSupabase();

    const [allBadgesRes, earnedRes] = await Promise.all([
      supabase.from('gamification_badges').select('*').order('created_at', { ascending: false }),
      supabase.from('user_badges').select('badge_id, awarded_at').eq('user_id', user.id),
    ]);

    if (allBadgesRes.error) throw allBadgesRes.error;
    if (earnedRes.error) throw earnedRes.error;

    const earned = new Map<string, string>();
    for (const r of earnedRes.data || []) {
      earned.set(String(r.badge_id), String(r.awarded_at));
    }

    return NextResponse.json({
      badges: allBadgesRes.data || [],
      earned: Array.from(earned.entries()).map(([badgeId, awardedAt]) => ({ badgeId, awardedAt })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error' }, { status: 500 });
  }
}

