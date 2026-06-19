import { NextResponse } from 'next/server';
import { requireMember } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireMember(req);
    const supabase = getServerSupabase();
    const res = await supabase.rpc('assign_member_no', { p_user_id: user.id });
    if (res.error) throw res.error;
    const memberNo = typeof res.data === 'number' ? res.data : Number(res.data);
    return NextResponse.json({ ok: true, memberNo });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
