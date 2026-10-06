import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface BulkApplicationsBody {
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
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = toRecord(await req.json().catch(() => ({})));
    const payload = body as BulkApplicationsBody;
    const ids = normalizeIds(payload.ids);

    if (!ids.length) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { error } = await supabase
      .from('applications')
      .update({ status: 'approved', decided_at: new Date().toISOString(), decided_by_email: user.email })
      .in('id', ids);

    if (error) throw error;

    // Log the action
    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'admin',
      admin_name: 'Admin API',
      action: 'APPLICATIONS_BULK_APPROVE',
      target_id: 'bulk',
      details: { ids, approvedBy: user.id }
    }]);

    ids.forEach((id) => {
      fetch(new URL('/api/admin/applications/status-email', req.url).toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': req.headers.get('cookie') || ''
        },
        body: JSON.stringify({ applicationId: id, status: 'approved' })
      }).catch(() => null);
    });

    return NextResponse.json({ success: true, count: ids.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
