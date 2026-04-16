import { NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireSuperadmin(req);
    const { slug } = await params;
    const s = String(slug || '').trim();
    if (!s) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase
      .from('site_page_contents')
      .select('slug,lang,title,content_html,updated_at')
      .eq('slug', s);
    if (res.error) throw res.error;
    const rows = res.data || [];
    const out = NextResponse.json({ ok: true, items: rows });
    out.headers.set('Cache-Control', 'no-store');
    return out;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    await requireSuperadmin(req);
    const { slug } = await params;
    const s = String(slug || '').trim();
    if (!s) return NextResponse.json({ error: 'Missing slug' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const cs = body?.cs && typeof body.cs === 'object' ? body.cs : {};
    const en = body?.en && typeof body.en === 'object' ? body.en : {};

    const supabase = getServerSupabase();
    const now = new Date().toISOString();

    const upserts = [
      { slug: s, lang: 'cs', title: cs.title ?? null, content_html: cs.content_html ?? null, updated_at: now },
      { slug: s, lang: 'en', title: en.title ?? null, content_html: en.content_html ?? null, updated_at: now },
    ];

    const res = await supabase.from('site_page_contents').upsert(upserts, { onConflict: 'slug,lang' }).select('slug,lang,title,content_html,updated_at');
    if (res.error) throw res.error;

    const out = NextResponse.json({ ok: true, items: res.data || [] });
    out.headers.set('Cache-Control', 'no-store');
    return out;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

