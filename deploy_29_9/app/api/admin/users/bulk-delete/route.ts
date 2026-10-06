import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface BulkDeleteBody {
  ids?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeIds(input: unknown): string[] {
  return Array.isArray(input) ? Array.from(new Set(input.map((id) => String(id || '').trim()).filter(Boolean))) : [];
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

    const body = toRecord(await req.json().catch(() => ({}))) as BulkDeleteBody;
    const ids = normalizeIds(body.ids);
    if (ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });

    const supabase = getServerSupabase();

    const filteredIds = ids.filter((id) => id !== user.id);

    for (const targetId of filteredIds) {
      const delAuth = await supabase.auth.admin.deleteUser(targetId);
      if (delAuth.error) {
        try {
          await supabase.from('admin_logs').insert([{
            admin_email: user.email || 'admin',
            admin_name: user.user_metadata?.full_name || user.email || 'admin',
            action: 'USER_DELETE_FAILED',
            target_id: targetId,
            details: { error: getErrorMessage(delAuth.error) }
          }]);
        } catch {}
      } else {
        try {
          await supabase.from('profiles').delete().eq('id', targetId);
        } catch {}
      }
    }

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: user.user_metadata?.full_name || user.email || 'admin',
      action: 'USERS_BULK_DELETE',
      details: { deleted_count: filteredIds.length, target_ids: filteredIds }
    }]);

    return NextResponse.json({ ok: true, deleted: filteredIds.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
