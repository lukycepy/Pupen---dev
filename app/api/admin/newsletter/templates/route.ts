import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface NewsletterTemplateRow {
  id?: string | number | null;
  name?: string | null;
  subject?: string | null;
  body_html?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface NewsletterTemplateBody {
  name?: unknown;
  subject?: unknown;
  body_html?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_templates')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    const templates: NewsletterTemplateRow[] = Array.isArray(data) ? data : [];
    return NextResponse.json({ templates });
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
    const payload = body as NewsletterTemplateBody;
    const name = String(payload.name || '').trim();
    const subject = String(payload.subject || '').trim();
    const bodyHtml = String(payload.body_html || '');

    if (!name || !subject || !bodyHtml) {
      return NextResponse.json({ error: 'Name, subject and body_html are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('newsletter_templates')
      .insert([{
        name,
        subject,
        body_html: bodyHtml,
        created_by: user.id,
      }])
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
