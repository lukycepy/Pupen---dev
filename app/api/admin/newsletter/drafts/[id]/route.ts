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
  updated_at?: string | null;
}

interface NewsletterDraftBody {
  subject?: unknown;
  subject_b?: unknown;
  body_html?: unknown;
  target_categories?: unknown;
  status?: unknown;
  ab_enabled?: unknown;
  ab_split?: unknown;
}

interface NewsletterDraftUpdate {
  updated_at: string;
  subject?: string | null;
  subject_b?: string | null;
  body_html?: string | null;
  target_categories?: string[];
  status?: string | null;
  ab_enabled?: boolean;
  ab_split?: number;
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

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = toRecord(await req.json().catch(() => ({})));
    const payload = body as NewsletterDraftBody;
    const { subject, body_html, target_categories, status, ab_enabled, subject_b, ab_split } = payload;

    const supabase = getServerSupabase();

    const updates: NewsletterDraftUpdate = { updated_at: new Date().toISOString() };
    if (subject !== undefined) updates.subject = subject === null ? null : String(subject);
    if (subject_b !== undefined) updates.subject_b = subject_b === null ? null : String(subject_b).trim() || null;
    if (ab_enabled !== undefined) updates.ab_enabled = !!ab_enabled;
    if (ab_split !== undefined) {
      const abSplitValue = Number(ab_split);
      if (Number.isFinite(abSplitValue)) {
        updates.ab_split = Math.min(90, Math.max(10, Math.round(abSplitValue)));
      }
    }
    if (body_html !== undefined) updates.body_html = body_html === null ? null : String(body_html);
    if (target_categories !== undefined) updates.target_categories = normalizeCategories(target_categories);
    if (status !== undefined) updates.status = status === null ? null : String(status);

    const { data, error } = await supabase
      .from('newsletter_drafts')
      .update(updates)
      .eq('id', id)
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

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;
    const supabase = getServerSupabase();
    
    const { error } = await supabase
      .from('newsletter_drafts')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
