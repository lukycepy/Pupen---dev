import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface MessageUpdateBody {
  status?: unknown;
  assigned_to?: unknown;
  tags?: unknown;
}

interface MessageUpdatePayload {
  status?: string;
  assigned_to?: string | null;
  tags?: string[] | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeTags(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  return input.map((tag) => String(tag || '').trim()).filter(Boolean);
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
    const body = toRecord(await req.json().catch(() => ({}))) as MessageUpdateBody;

    const updates: MessageUpdatePayload = {};
    if (body.status !== undefined) updates.status = String(body.status || '').trim();
    if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to ? String(body.assigned_to).trim() : null;
    if (body.tags !== undefined) updates.tags = normalizeTags(body.tags);

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('messages')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ message: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
