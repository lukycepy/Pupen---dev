import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface AwardBadgeBody {
  action?: unknown;
  user_id?: unknown;
  badge_id?: unknown;
}

interface UserBadgeRow {
  id?: string | null;
  user_id?: string | null;
  badge_id?: string | null;
  awarded_by?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = toRecord(await req.json().catch(() => ({}))) as AwardBadgeBody;
    const action = String(body.action || '').trim();
    const user_id = String(body.user_id || '').trim();
    const badge_id = String(body.badge_id || '').trim();

    if (!user_id || !badge_id || !action) {
      return NextResponse.json({ error: 'Missing required fields (action, user_id, badge_id)' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    if (action === 'award') {
      const { data, error } = await supabase
        .from('user_badges')
        .insert([{ user_id, badge_id, awarded_by: user.id }])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          return NextResponse.json({ error: 'User already has this badge' }, { status: 400 });
        }
        throw error;
      }
      return NextResponse.json({ user_badge: data as UserBadgeRow });
    } else if (action === 'revoke') {
      const { error } = await supabase
        .from('user_badges')
        .delete()
        .match({ user_id, badge_id });

      if (error) throw error;
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "award" or "revoke"' }, { status: 400 });
    }

  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
