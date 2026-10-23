import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Error');
  }
  return String(error || 'Error');
}

function isMissingRelation(error: unknown, relation: string) {
  const message = getErrorMessage(error);
  return new RegExp(relation, 'i').test(message) && /(schema cache|does not exist|relation|table)/i.test(message);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail((body as Record<string, unknown>)?.email);
    if (!email || !email.includes('@')) {
      return NextResponse.json({ email: '' }, { status: 200 });
    }

    const supabase = getServerSupabase();

    try {
      const aliasRes = await supabase
        .from('user_login_aliases')
        .select('user_id')
        .eq('normalized_email', email)
        .maybeSingle<{ user_id?: string | null }>();
      if (aliasRes.error) throw aliasRes.error;

      const userId = String(aliasRes.data?.user_id || '').trim();
      if (userId) {
        const profileRes = await supabase.from('profiles').select('email').eq('id', userId).maybeSingle<{ email?: string | null }>();
        if (!profileRes.error) {
          const resolvedEmail = normalizeEmail(profileRes.data?.email);
          if (resolvedEmail) return NextResponse.json({ email: resolvedEmail });
        }
      }
    } catch (error: unknown) {
      if (!isMissingRelation(error, 'user_login_aliases')) throw error;
    }

    return NextResponse.json({ email });
  } catch {
    return NextResponse.json({ email: '' }, { status: 200 });
  }
}
