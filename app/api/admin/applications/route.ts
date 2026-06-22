import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

type JsonRecord = Record<string, unknown>;

interface ApplicationRow extends JsonRecord {
  id?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  membership_type?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  excluded_at?: string | null;
}

interface MemberDocumentRow {
  id?: string | number | null;
  member_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  bucket?: string | null;
  path?: string | null;
  original_name?: string | null;
}

interface ProfileRow {
  id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface MemberAdminProfileRow {
  member_id?: string | null;
  phone?: string | null;
  address?: string | null;
  application_received_at?: string | null;
}

type ManualApplicationRow = ApplicationRow & {
  __source: 'manual_scan';
  __scan: {
    bucket: string;
    path: string;
    original_name: string;
  };
};

function toBool(v: unknown) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === '1' || v.toLowerCase() === 'true';
  return false;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
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

    const url = new URL(req.url);
    const pendingCount = toBool(url.searchParams.get('pendingCount'));
    const includeExcluded = toBool(url.searchParams.get('includeExcluded'));

    const supabase = getServerSupabase();

    if (pendingCount) {
      let q = supabase.from('applications').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      if (!includeExcluded) q = q.is('excluded_at', null);
      const res = await q;
      if (res.error) throw res.error;
      return NextResponse.json({ ok: true, count: Number(res.count || 0) });
    }

    const appsRes = await supabase.from('applications').select('*').order('created_at', { ascending: false });
    if (appsRes.error) throw appsRes.error;
    const apps: ApplicationRow[] = Array.isArray(appsRes.data) ? appsRes.data : [];

    let manual: ManualApplicationRow[] = [];
    try {
      const docsRes = await supabase
        .from('member_documents')
        .select('id,member_id,created_at,updated_at,bucket,path,original_name')
        .eq('kind', 'application_scan')
        .order('updated_at', { ascending: false });
      if (docsRes.error) throw docsRes.error;

      const docs: MemberDocumentRow[] = Array.isArray(docsRes.data) ? docsRes.data : [];
      const memberIds = Array.from(new Set(docs.map((d) => String(d.member_id || '')).filter(Boolean)));

      if (memberIds.length) {
        const [profRes, adminRes] = await Promise.all([
          supabase.from('profiles').select('id,email,first_name,last_name').in('id', memberIds),
          supabase.from('member_admin_profile').select('member_id,phone,address,application_received_at').in('member_id', memberIds),
        ]);
        const profiles: ProfileRow[] = Array.isArray(profRes.data) ? profRes.data : [];
        const adminProfiles: MemberAdminProfileRow[] = Array.isArray(adminRes.data) ? adminRes.data : [];
        const profileById = new Map<string, ProfileRow>(profiles.map((p) => [String(p.id), p]));
        const adminById = new Map<string, MemberAdminProfileRow>(adminProfiles.map((p) => [String(p.member_id), p]));

        manual = docs.map((d) => {
          const memberId = String(d.member_id || '');
          const p = profileById.get(memberId) || {};
          const ap = adminById.get(memberId) || {};
          const first_name = String(p.first_name || '').trim();
          const last_name = String(p.last_name || '').trim();
          const full_name = `${first_name} ${last_name}`.trim() || String(p.email || '').split('@')[0] || '—';
          const created_at = ap.application_received_at || d.updated_at || d.created_at || new Date().toISOString();
          return {
            id: `manual-${String(d.id || memberId)}`,
            created_at,
            updated_at: created_at,
            status: 'manual',
            membership_type: null,
            first_name: first_name || null,
            last_name: last_name || null,
            full_name,
            name: full_name,
            email: String(p.email || '').trim().toLowerCase() || null,
            phone: ap.phone || null,
            address: ap.address || null,
            gdpr_consent: null,
            university_email: null,
            field_of_study: null,
            study_year: null,
            signed_on: null,
            applicant_signature: null,
            signature_data_url: null,
            chairwoman_signature: null,
            rejection_reason: null,
            decided_at: null,
            decided_by_email: null,
            decision_membership_type: null,
            motivation: null,
            __source: 'manual_scan',
            __scan: {
              bucket: String(d.bucket || ''),
              path: String(d.path || ''),
              original_name: String(d.original_name || ''),
            },
          };
        });
      }
    } catch {
      manual = [];
    }

    const merged = [...manual, ...apps]
      .filter((application) => {
        if ('__source' in application && application.__source === 'manual_scan') return true;
        if (includeExcluded) return true;
        return !application.excluded_at;
      })
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

    return NextResponse.json({ ok: true, applications: merged });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = toRecord(await req.json().catch(() => ({})));
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const patch: JsonRecord = {};
    const allow = [
      'status',
      'chairwoman_signature',
      'rejection_reason',
      'decision_membership_type',
      'decided_at',
      'decided_by_email',
      'excluded_at',
      'excluded_by_email',
      'excluded_reason',
    ];
    for (const k of allow) {
      if (Object.prototype.hasOwnProperty.call(body, k)) patch[k] = body[k];
    }

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      patch.decided_at = patch.decided_at || new Date().toISOString();
      patch.decided_by_email = patch.decided_by_email || user.email || null;
    }

    const supabase = getServerSupabase();
    const res = await supabase.from('applications').update(patch).eq('id', id);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = toRecord(await req.json().catch(() => ({})));
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (id.startsWith('manual-')) return NextResponse.json({ error: 'Manual application cannot be deleted here' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase.from('applications').delete().eq('id', id);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = getErrorMessage(error);
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
