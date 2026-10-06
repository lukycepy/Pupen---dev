import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface NewsletterTemplateRow {
  id?: string | number | null;
  name?: string | null;
  subject?: string | null;
  body_html?: string | null;
  updated_at?: string | null;
}

interface NewsletterTemplateBody {
  name?: unknown;
  subject?: unknown;
  body_html?: unknown;
}

interface NewsletterTemplateUpdate {
  updated_at: string;
  name?: string | null;
  subject?: string | null;
  body_html?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = toRecord(await req.json().catch(() => ({})));
    const payload = body as NewsletterTemplateBody;
    const { name, subject, body_html } = payload;

    const supabase = getServerSupabase();

    const updates: NewsletterTemplateUpdate = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name === null ? null : String(name);
    if (subject !== undefined) updates.subject = subject === null ? null : String(subject);
    if (body_html !== undefined) updates.body_html = body_html === null ? null : String(body_html);

    const { data, error } = await supabase
      .from('newsletter_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single<NewsletterTemplateRow>();

    if (error) throw error;
    return NextResponse.json({ template: data });
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
      .from('newsletter_templates')
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
