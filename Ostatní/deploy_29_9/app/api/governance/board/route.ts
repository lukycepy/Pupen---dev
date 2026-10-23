import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

interface BoardDirectoryLogRow {
  created_at?: string | null;
  details?: Record<string, unknown> | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeRoles(input: unknown): Record<string, unknown>[] {
  return Array.isArray(input)
    ? input.filter((role): role is Record<string, unknown> => !!role && typeof role === 'object')
    : [];
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireUser(req);
    const supabase = getServerSupabase();
    const res = await supabase
      .from('admin_logs')
      .select('id, created_at, details')
      .eq('action', 'BOARD_DIRECTORY')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (res.error) throw res.error;

    const row = (res.data || null) as BoardDirectoryLogRow | null;
    const details = toRecord(row?.details);
    return NextResponse.json({
      ok: true,
      updatedAt: row?.created_at || null,
      roles: normalizeRoles(details.roles),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
