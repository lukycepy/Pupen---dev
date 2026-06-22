import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

interface NewsletterPreferencesRow {
  categories?: string[] | null;
  consent?: boolean | null;
  unsubscribed_at?: string | null;
}

interface ProfileMarketingRow {
  marketing_consent?: boolean | null;
}

function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
}

function normalizeCategories(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const cats = Array.from(new Set(arr.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!cats.length) return ['all'];
  if (cats.includes('all')) return ['all'];
  return cats;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function isMissingColumn(error: unknown) {
  const message = getErrorMessage(error);
  return /(schema cache|does not exist|column)/i.test(message);
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'nl_prefs',
      windowMs: 60_000,
      max: 20,
      honeypotResponse: { ok: true, status: 'preferences_updated' },
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const user = await requireUser(req);
    const email = normalizeEmail(user.email || '');
    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const categories = normalizeCategories(body.categories);
    const consent = body.consent === false ? false : true;
    const nowIso = new Date().toISOString();

    const supabase = getServerSupabase();
    let upsert = await supabase.from('newsletter_subscriptions').upsert(
      [
        {
          email,
          categories,
          consent,
          updated_at: nowIso,
          unsubscribed_at: consent ? null : nowIso,
          unsubscribe_source: consent ? null : 'member_preferences',
          source: 'member_preferences',
        },
      ],
      { onConflict: 'email' },
    );

    if (upsert.error && isMissingColumn(upsert.error)) {
      upsert = await supabase.from('newsletter_subscriptions').upsert(
        [
          {
            email,
            categories,
            consent,
            source: 'member_preferences',
          },
        ],
        { onConflict: 'email' },
      );
    }

    if (upsert.error) throw upsert.error;

    let profUp = await supabase
      .from('profiles')
      .update({
        marketing_consent: consent,
        marketing_consent_at: consent ? nowIso : null,
      })
      .eq('id', user.id);
    if (profUp.error && isMissingColumn(profUp.error)) {
      profUp = await supabase.from('profiles').update({ marketing_consent: consent }).eq('id', user.id);
    }
    if (profUp.error) throw profUp.error;

    return NextResponse.json({ ok: true, status: 'preferences_updated' });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const email = normalizeEmail(user.email || '');
    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const profileRes = await supabase.from('profiles').select('marketing_consent').eq('id', user.id).maybeSingle<ProfileMarketingRow>();
    if (profileRes.error && profileRes.error.code !== 'PGRST116') throw profileRes.error;
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .select('categories, consent, unsubscribed_at')
      .eq('email', email)
      .maybeSingle<NewsletterPreferencesRow>();

    if (error && error.code !== 'PGRST116') throw error; // ignore not found

    const consent = data
      ? data.consent === true && !data.unsubscribed_at
      : profileRes.data?.marketing_consent === true;

    return NextResponse.json({
      preferences: { categories: data?.categories || ['all'], consent },
      exists: !!data
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
