import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import {
  isNewsletterEmail,
  normalizeNewsletterCategories,
  normalizeNewsletterEmail,
  normalizeNewsletterLang,
  subscribeToNewsletter,
} from '@/lib/newsletter/subscribe';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'nl_sub',
      windowMs: 10 * 60_000,
      max: 30,
      honeypotResponse: { ok: true, status: 'created' },
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;
    const body = g.body && typeof g.body === 'object' ? (g.body as Record<string, unknown>) : {};

    const email = normalizeNewsletterEmail(body.email);
    const categories = normalizeNewsletterCategories(body.categories);
    const source = body.source != null ? String(body.source).slice(0, 80) : 'web';
    const lang = normalizeNewsletterLang(body.lang);

    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });
    if (!isNewsletterEmail(email)) return NextResponse.json({ error: 'Neplatný e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const result = await subscribeToNewsletter({
      supabase,
      email,
      categories: body.categories !== undefined ? categories : undefined,
      source,
      lang,
      requestUrl: req.url,
      preferences: body.preferences && typeof body.preferences === 'object' ? (body.preferences as Record<string, unknown>) : undefined,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
