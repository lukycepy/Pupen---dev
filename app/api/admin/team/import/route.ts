import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface TeamImportBody {
  rows?: unknown;
}

interface TeamImportRow {
  name?: unknown;
  role?: unknown;
  bio?: unknown;
  email?: unknown;
  phone?: unknown;
  social_linkedin?: unknown;
  sort_order?: unknown;
}

interface TeamInsertRow {
  name: string;
  role: string;
  bio: string;
  email: string | null;
  phone: string | null;
  social_linkedin: string | null;
  sort_order: number;
  is_active: boolean;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeImportRow(row: unknown, index: number): TeamInsertRow | null {
  const record = toRecord(row) as TeamImportRow;
  const name = String(record.name || '').trim();
  const role = String(record.role || '').trim();
  if (!name || !role) return null;
  return {
    name,
    role,
    bio: String(record.bio || '').trim(),
    email: record.email ? String(record.email).trim() : null,
    phone: record.phone ? String(record.phone).trim() : null,
    social_linkedin: record.social_linkedin ? String(record.social_linkedin).trim() : null,
    sort_order: parseInt(String(record.sort_order || ''), 10) || (index + 1) * 10,
    is_active: true,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { profile, user } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = toRecord(await req.json().catch(() => ({}))) as TeamImportBody;
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ error: 'Žádná data k importu' }, { status: 400 });

    const supabase = getServerSupabase();
    const inserts = rows
      .map((row, index) => normalizeImportRow(row, index))
      .filter((row): row is TeamInsertRow => row !== null);

    if (!inserts.length) return NextResponse.json({ error: 'Žádné validní záznamy v CSV (chybí name nebo role)' }, { status: 400 });

    const { error } = await supabase.from('team_members').insert(inserts).select();
    if (error) throw error;

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: user.user_metadata?.full_name || 'admin',
      action: 'TEAM_CSV_IMPORT',
      details: { imported_count: inserts.length }
    }]);

    return NextResponse.json({ ok: true, imported: inserts.length });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
