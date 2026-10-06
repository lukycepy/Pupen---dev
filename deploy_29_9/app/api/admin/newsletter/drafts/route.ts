import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface NewsletterDraftRow {
  id?: string | number | null;
  subject?: string | null;
  subject_b?: string | null;
  body_html?: string | null;
  target_categories?: string[] | null;
  ab_enabled?: boolean | null;
  ab_split?: number | null;
  status?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface NewsletterDraftBody {
  subject?: unknown;
  subject_b?: unknown;
  body_html?: unknown;
  target_categories?: unknown;
  ab_enabled?: unknown;
  ab_split?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function normalizeCategories(input: unknown): string[] {
  const categories = Array.isArray(input)
    ? Array.from(new Set(input.map((item) => String(item || '').trim()).filter(Boolean)))
    : [];
  if (!categories.length) return ['all'];
  if (categories.includes('all')) return ['all'];
  return categories;
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_drafts')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    const drafts: NewsletterDraftRow[] = Array.isArray(data) ? data : [];
    return NextResponse.json({ drafts });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = toRecord(await req.json().catch(() => ({})));
    const payload = body as NewsletterDraftBody;
    const subject = String(payload.subject || '').trim() || 'Bez předmětu';
    const bodyHtml = String(payload.body_html || '');
    const targetCategories = normalizeCategories(payload.target_categories);
    const abEnabled = !!payload.ab_enabled;
    const subjectB = String(payload.subject_b || '').trim() || null;
    const ab_split_raw = Number(payload.ab_split);
    const ab_split = Number.isFinite(ab_split_raw) ? Math.min(90, Math.max(10, Math.round(ab_split_raw))) : 50;

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_drafts')
      .insert([{
        subject,
        subject_b: subjectB,
        ab_enabled: abEnabled,
        ab_split,
        body_html: bodyHtml,
        target_categories: targetCategories,
        created_by: user.id,
      }])
      .select()
      .single<NewsletterDraftRow>();

    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
