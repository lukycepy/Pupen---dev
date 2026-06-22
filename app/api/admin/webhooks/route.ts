import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface WebhookRow {
  id?: string | null;
  name?: string | null;
  url?: string | null;
  events?: string[] | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface CreateWebhookBody {
  name?: unknown;
  url?: unknown;
  events?: unknown;
  is_active?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeEvents(input: unknown): string[] {
  return Array.isArray(input)
    ? input.map((event) => String(event || '').trim()).filter(Boolean)
    : [];
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
      .from('webhooks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ webhooks: (data || []) as WebhookRow[] });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = toRecord(await req.json().catch(() => ({}))) as CreateWebhookBody;
    const name = String(body.name || '').trim();
    const url = String(body.url || '').trim();
    const events = normalizeEvents(body.events);
    const isActive = body.is_active !== false;

    if (!name || !url) {
      return NextResponse.json({ error: 'Name and URL are required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('webhooks')
      .insert([{ 
        name, 
        url, 
        events,
        is_active: isActive
      }])
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ webhook: data as WebhookRow });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
