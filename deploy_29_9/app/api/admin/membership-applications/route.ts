import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { membershipApplicationAdminListQuerySchema } from '@/lib/validations/membership-applications-admin';

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationDecisionMeta {
  decided_at?: string | null;
  decided_by_email?: string | null;
  membership_type?: string | null;
  chair_auth_kind?: string | null;
  chair_auth_file_id?: string | null;
}

interface MembershipApplicationMeta extends JsonRecord {
  lang?: string | null;
  membership_type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  decision?: MembershipApplicationDecisionMeta | JsonRecord | null;
  pdf_snapshot?: unknown;
}

interface MembershipApplicationListRow {
  id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  motivation?: string | null;
  decision_reason?: string | null;
  meta?: MembershipApplicationMeta | JsonRecord | null;
}

function isTruthy(v: string) {
  const s = String(v || '').toLowerCase().trim();
  return s === '1' || s === 'true';
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const url = new URL(req.url);
    const parsed = membershipApplicationAdminListQuerySchema.safeParse({
      limit: url.searchParams.get('limit'),
      offset: url.searchParams.get('offset'),
      q: url.searchParams.get('q') || '',
      status: url.searchParams.get('status') || undefined,
      pendingCount: url.searchParams.get('pendingCount') || '0',
    });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid query' }, { status: 400 });

    const q = String(parsed.data.q || '').trim();
    const includePendingCount = isTruthy(parsed.data.pendingCount);

    if (includePendingCount) {
      const countRes = await rls
        .from('membership_applications_v2')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (countRes.error) throw countRes.error;
      return NextResponse.json({ ok: true, count: Number(countRes.count || 0) });
    }

    let query = rls
      .from('membership_applications_v2')
      .select('id,created_at,updated_at,status,name,email,phone,address,motivation,decision_reason,meta', { count: 'exact' });

    if (parsed.data.status) query = query.eq('status', parsed.data.status);
    if (q) {
      const qq = q.replaceAll(',', ' ').trim();
      query = query.or(`name.ilike.%${qq}%,email.ilike.%${qq}%,phone.ilike.%${qq}%`);
    }

    const res = await query
      .order('created_at', { ascending: false })
      .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (res.error) throw res.error;

    const rows = (Array.isArray(res.data) ? res.data : []).map((row) => {
      const r = row as MembershipApplicationListRow;
      const meta = toRecord(r.meta);
      const decision = toRecord(meta.decision);
      return {
        id: r.id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        status: r.status,
        name: r.name,
        email: r.email,
        phone: r.phone,
        address: r.address,
        motivation: r.motivation,
        decisionReason: r.decision_reason,
        meta: {
          lang: meta?.lang || null,
          membership_type: meta?.membership_type || null,
          first_name: meta?.first_name || null,
          last_name: meta?.last_name || null,
          decision: {
            decided_at: decision?.decided_at || null,
            decided_by_email: decision?.decided_by_email || null,
            membership_type: decision?.membership_type || null,
            chair_auth_kind: decision?.chair_auth_kind || null,
            chair_auth_file_id: decision?.chair_auth_file_id || null,
          },
          has_pdf_snapshot: !!meta?.pdf_snapshot,
        },
      };
    });

    return NextResponse.json({ ok: true, rows, count: typeof res.count === 'number' ? res.count : null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
