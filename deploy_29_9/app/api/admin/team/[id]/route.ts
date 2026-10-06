import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface TeamMemberBody {
  name?: unknown;
  role?: unknown;
  bio?: unknown;
  email?: unknown;
  phone?: unknown;
  social_linkedin?: unknown;
  sort_order?: unknown;
  is_active?: unknown;
}

interface TeamMemberRow {
  id?: string | null;
  name?: string | null;
  role?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  social_linkedin?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function pickTeamMemberPayload(input: unknown) {
  const record = toRecord(input) as TeamMemberBody;
  return {
    name: String(record.name || '').trim(),
    role: String(record.role || '').trim(),
    bio: record.bio != null ? String(record.bio) : '',
    email: record.email ? String(record.email).trim() : null,
    phone: record.phone ? String(record.phone).trim() : null,
    social_linkedin: record.social_linkedin ? String(record.social_linkedin).trim() : null,
    sort_order: Number.isFinite(Number(record.sort_order)) ? Number(record.sort_order) : 0,
    is_active: record.is_active !== false,
  };
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
    const body = pickTeamMemberPayload(await req.json().catch(() => ({})));
    if (!body.name || !body.role) {
      return NextResponse.json({ error: 'Name and role are required' }, { status: 400 });
    }
    const supabase = getServerSupabase();
    
    const { data, error } = await supabase
      .from('team_members')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ member: data as TeamMemberRow });
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
      .from('team_members')
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
