import { NextResponse } from 'next/server';
import { getBearerToken } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';

type ProfileRow = Record<string, unknown>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) throw new Error('Unauthorized');
    const supabase = getRlsSupabase(token);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<ProfileRow>();
    if (error) throw error;
    return NextResponse.json({ profile: profile || null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
