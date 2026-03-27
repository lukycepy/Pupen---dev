import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

function getAnonServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

export async function GET(req: Request) {
  try {
    const ip = getClientIp(req);
    const rl = rateLimit({ key: `search:${ip || 'unknown'}`, windowMs: 60_000, max: 120 });
    if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const url = new URL(req.url);
    const qRaw = (url.searchParams.get('q') || '').trim();
    const q = qRaw.slice(0, 80);
    const lang = (url.searchParams.get('lang') || 'cs') === 'en' ? 'en' : 'cs';
    const limit = Math.max(1, Math.min(10, Number(url.searchParams.get('limit') || 5)));

    if (q.length < 2) {
      return NextResponse.json({
        ok: true,
        results: { events: [], posts: [], faqs: [], books: [], discounts: [], guide: [], archive: [] },
      });
    }

    const nowIso = new Date().toISOString();
    const supabase = getAnonServerSupabase();

    const safe = async (p: any) => {
      try {
        const res = await p;
        if (res?.error) {
          const msg = String(res.error.message || '');
          if (/does not exist|schema cache|Could not find the table|Could not find the function|column .* does not exist/i.test(msg)) {
            return { data: [] };
          }
          return { data: [] };
        }
        return res;
      } catch {
        return { data: [] };
      }
    };

    const archivePrimary = async () =>
      safe(
        supabase
          .from('activity_archive')
          .select('id,year,title,title_en,description,description_en')
          .or(
            `title.ilike.%${q}%,title_en.ilike.%${q}%,description.ilike.%${q}%,description_en.ilike.%${q}%`,
          )
          .order('year', { ascending: false })
          .limit(limit),
      );

    const archiveFallback = async () =>
      safe(
        supabase
          .from('archive_entries')
          .select('id,year,title,title_en,description,description_en')
          .or(
            `title.ilike.%${q}%,title_en.ilike.%${q}%,description.ilike.%${q}%,description_en.ilike.%${q}%`,
          )
          .order('year', { ascending: false })
          .limit(limit),
      );

    const [eventsRes, postsRes, faqsRes, booksRes, discountsRes, guideRes, archiveResPrimary] = await Promise.all([
      (async () => {
        const run = (withMemberFilter: boolean) => {
          let q1 = supabase
            .from('events')
            .select('id,title,title_en,date,location,image_url,published_at')
            .not('published_at', 'is', null)
            .lte('published_at', nowIso)
            .or(`title.ilike.%${q}%,title_en.ilike.%${q}%`)
            .order('date', { ascending: true })
            .limit(limit);
          if (withMemberFilter) q1 = q1.eq('is_member_only', false);
          return q1;
        };
        let res = await run(true);
        if (res?.error && /is_member_only/i.test(res.error.message) && /schema cache/i.test(res.error.message)) {
          res = await run(false);
        }
        return res;
      })(),
      supabase
        .from('posts')
        .select('id,title,title_en,excerpt,excerpt_en,category,image_url,published_at')
        .not('published_at', 'is', null)
        .lte('published_at', nowIso)
        .or(`title.ilike.%${q}%,title_en.ilike.%${q}%,excerpt.ilike.%${q}%,excerpt_en.ilike.%${q}%`)
        .order('published_at', { ascending: false })
        .limit(limit),
      supabase
        .from('faqs')
        .select('id,question,question_en,answer,answer_en,category,sort_order,is_public')
        .eq('is_public', true)
        .or(`question.ilike.%${q}%,question_en.ilike.%${q}%,answer.ilike.%${q}%,answer_en.ilike.%${q}%`)
        .order('sort_order', { ascending: true })
        .limit(limit),
      safe(
        supabase
          .from('book_exchange')
          .select('id,title,author,price,created_at,status,is_sold')
          .eq('status', 'active')
          .eq('is_sold', false)
          .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
          .order('created_at', { ascending: false })
          .limit(limit),
      ),
      safe(
        supabase
          .from('isic_discounts')
          .select('id,title,category,discount,location_name')
          .or(`title.ilike.%${q}%,category.ilike.%${q}%`)
          .order('title', { ascending: true })
          .limit(limit),
      ),
      safe(
        supabase
          .from('freshman_guide')
          .select('id,slug,title,category,excerpt,content,sort_order')
          .or(`title.ilike.%${q}%,content.ilike.%${q}%,excerpt.ilike.%${q}%`)
          .order('sort_order', { ascending: true })
          .limit(limit),
      ),
      archivePrimary(),
    ]);

    const eventsOk = eventsRes?.error ? { data: [] } : eventsRes;
    const postsOk = postsRes?.error ? { data: [] } : postsRes;
    const faqsOk = faqsRes?.error ? { data: [] } : faqsRes;

    const archiveRes =
      (archiveResPrimary?.data || []).length > 0 ? archiveResPrimary : await archiveFallback();

    const normalize = (row: any) => {
      if (!row || typeof row !== 'object') return row;
      if (lang !== 'en') return row;
      const copy: any = { ...row };
      if (copy.title_en) copy.title = copy.title_en;
      if (copy.excerpt_en) copy.excerpt = copy.excerpt_en;
      if (copy.question_en) copy.question = copy.question_en;
      if (copy.answer_en) copy.answer = copy.answer_en;
      if (copy.description_en) copy.description = copy.description_en;
      return copy;
    };

    return NextResponse.json({
      ok: true,
      results: {
        events: (eventsOk.data || []).map(normalize),
        posts: (postsOk.data || []).map(normalize),
        faqs: (faqsOk.data || []).map(normalize),
        books: (booksRes.data || []).map(normalize),
        discounts: (discountsRes.data || []).map(normalize),
        guide: (guideRes.data || []).map(normalize),
        archive: (archiveRes.data || []).map(normalize),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
