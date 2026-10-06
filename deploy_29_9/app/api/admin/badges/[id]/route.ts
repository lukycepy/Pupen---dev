import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface UpdateBadgeBody {
  name?: unknown;
  description?: unknown;
  icon?: unknown;
  criteria?: unknown;
  points?: unknown;
}

interface BadgeRow {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  icon?: string | null;
  criteria?: string | null;
  points?: number | null;
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
    const body = toRecord(await req.json().catch(() => ({}))) as UpdateBadgeBody;
    const name = String(body.name || '').trim();
    const description = body.description != null ? String(body.description) : null;
    const icon = body.icon != null ? String(body.icon) : null;
    const criteria = body.criteria != null ? String(body.criteria) : null;
    const points = Number(body.points || 0);

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('gamification_badges')
      .update({ name, description, icon, criteria, points: points || 0 })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ badge: data as BadgeRow });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
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
      .from('gamification_badges')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
