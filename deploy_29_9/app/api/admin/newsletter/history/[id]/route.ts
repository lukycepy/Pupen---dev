import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

interface NewsletterCampaignRow {
  id?: string | null;
  created_at?: string | null;
  subject?: string | null;
  html?: string | null;
  sent_at?: string | null;
  target_count?: number | null;
  open_count?: number | null;
  click_count?: number | null;
  ab_enabled?: boolean | null;
  subject_a?: string | null;
  subject_b?: string | null;
  ab_split?: number | null;
}

interface NewsletterEventRow {
  event_type?: string | null;
  email?: string | null;
  link_url?: string | null;
  created_at?: string | null;
  variant?: string | null;
}

type VariantBucket = 'a' | 'b' | 'other';

interface VariantCounts {
  a: number;
  b: number;
  other: number;
}

function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function getVariantBucket(variant: unknown): VariantBucket {
  const value = String(variant || '').toLowerCase();
  return value === 'a' || value === 'b' ? value : 'other';
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const newsletterId = String(id || '').trim();
    if (!isUuid(newsletterId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

    const supabase = getServerSupabase();

    const campRes = await supabase
      .from('newsletter')
      .select('id,created_at,subject,html,sent_at,target_count,open_count,click_count,ab_enabled,subject_a,subject_b,ab_split')
      .eq('id', newsletterId)
      .maybeSingle<NewsletterCampaignRow>();
    if (campRes.error) throw campRes.error;
    if (!campRes.data?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const evRes = await supabase
      .from('newsletter_events')
      .select('event_type,email,link_url,created_at,variant')
      .eq('newsletter_id', newsletterId)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (evRes.error) throw evRes.error;
    const events: NewsletterEventRow[] = Array.isArray(evRes.data) ? evRes.data : [];

    const uniqOpen = new Set<string>();
    const uniqClick = new Set<string>();
    const linkCounts = new Map<string, number>();
    const variantOpen: VariantCounts = { a: 0, b: 0, other: 0 };
    const variantClick: VariantCounts = { a: 0, b: 0, other: 0 };

    for (const event of events) {
      const email = String(event.email || '').trim().toLowerCase();
      const bucket = getVariantBucket(event.variant);
      if (String(event.event_type) === 'open') {
        if (email) uniqOpen.add(email);
        variantOpen[bucket] += 1;
      } else if (String(event.event_type) === 'click') {
        if (email) uniqClick.add(email);
        variantClick[bucket] += 1;
        const url = String(event.link_url || '').trim();
        if (url) linkCounts.set(url, (linkCounts.get(url) || 0) + 1);
      }
    }

    const topLinks = Array.from(linkCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([url, count]) => ({ url, count }));

    return NextResponse.json({
      ok: true,
      campaign: campRes.data,
      stats: {
        uniqueOpenCount: uniqOpen.size,
        uniqueClickCount: uniqClick.size,
        variantOpen,
        variantClick,
      },
      topLinks,
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
