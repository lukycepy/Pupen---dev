import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

type ProfileRow = Record<string, unknown>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const supabase = getServerSupabase();
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<ProfileRow>();
    if (error) throw error;
    return NextResponse.json({ profile: profile || null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
