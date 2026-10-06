import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';

interface BoardRoleInput {
  role?: unknown;
  name?: unknown;
  email?: unknown;
  note?: unknown;
}

interface BoardRole {
  role: string;
  name: string;
  email: string;
  note: string;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeBoardRole(value: unknown): BoardRole {
  const role = value as BoardRoleInput;
  return {
    role: String(role?.role || '').trim(),
    name: String(role?.name || '').trim(),
    email: String(role?.email || '').trim(),
    note: role?.note ? String(role.note).trim() : '',
  };
}

function isValidBoardRole(role: BoardRole) {
  return !!role.role && !!(role.name || role.email);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const roles = Array.isArray(body.roles) ? body.roles : [];

    const normalized = roles
      .map((role) => normalizeBoardRole(toRecord(role)))
      .filter((role) => isValidBoardRole(role))
      .slice(0, 30);

    const supabase = getServerSupabase();
    const res = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Board',
        action: 'BOARD_DIRECTORY',
        target_id: null,
        details: { roles: normalized, updatedAt: new Date().toISOString() },
      },
    ]);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
