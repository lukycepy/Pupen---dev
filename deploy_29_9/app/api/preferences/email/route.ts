import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

const DEFAULT_PREFS = {
  digestWeekly: true,
  categories: {
    events: true,
    community: true,
    finance: true,
    news: true,
  },
};

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function isExplicitFalse(value: unknown) {
  return value === false;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('admin_logs')
      .select('created_at, details')
      .eq('action', 'USER_EMAIL_PREFS')
      .eq('target_id', String(user.id))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw res.error;

    const prefs = res.data?.details?.prefs && typeof res.data.details.prefs === 'object' ? res.data.details.prefs : {};
    return NextResponse.json({ ok: true, updatedAt: res.data?.created_at || null, prefs: { ...DEFAULT_PREFS, ...prefs } });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const g = await guardPublicJsonPost(req, {
      keyPrefix: `email_prefs:${user.id}`,
      windowMs: 60 * 60 * 1000,
      max: 60,
      honeypot: false,
      tooManyMessage: 'Příliš mnoho požadavků. Zkuste to prosím později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const input = toRecord(body.prefs);
    const categories = toRecord(input.categories);

    const prefs = {
      digestWeekly: isExplicitFalse(input.digestWeekly) ? false : true,
      categories: {
        events: isExplicitFalse(categories.events) ? false : true,
        community: isExplicitFalse(categories.community) ? false : true,
        finance: isExplicitFalse(categories.finance) ? false : true,
        news: isExplicitFalse(categories.news) ? false : true,
      },
    };

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'member',
        admin_name: 'EmailPrefs',
        action: 'USER_EMAIL_PREFS',
        target_id: String(user.id),
        details: { prefs, email: user.email || null, updatedAt: new Date().toISOString() },
      },
    ]);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
