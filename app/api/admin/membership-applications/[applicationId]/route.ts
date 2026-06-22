import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { membershipApplicationAdminUpdateSchema } from '@/lib/validations/membership-applications-admin';
import { writeAuditLog } from '@/lib/audit/audit-log';

type JsonRecord = Record<string, unknown>;

interface MembershipApplicationRow {
  id?: string | null;
  status?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  motivation?: string | null;
  faculty?: string | null;
  meta?: JsonRecord | null;
}

interface MembershipApplicationFileRow {
  id?: string | number | null;
  created_at?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  size_bytes?: number | null;
  meta?: JsonRecord | null;
}

function toRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' ? (value as JsonRecord) : {};
}

function mergeMeta(prev: unknown, patch: unknown) {
  const base = toRecord(prev);
  const p = toRecord(patch);
  const next: JsonRecord = { ...base };
  for (const [k, v] of Object.entries(p)) {
    if (k === 'pdf_snapshot' && v && typeof v === 'object') {
      const prevSnap = toRecord(next.pdf_snapshot);
      next.pdf_snapshot = { ...prevSnap, ...toRecord(v) };
      continue;
    }
    next[k] = v;
  }
  return next;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const appRes = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const filesRes = await rls
      .from('membership_application_files')
      .select('id,created_at,file_name,mime_type,size_bytes,meta')
      .eq('application_id', id)
      .order('created_at', { ascending: false });
    if (filesRes.error) throw filesRes.error;

    const files: MembershipApplicationFileRow[] = Array.isArray(filesRes.data) ? filesRes.data : [];
    return NextResponse.json({ ok: true, application: appRes.data, files });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ applicationId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { applicationId } = await ctx.params;
    const id = String(applicationId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const parsed = membershipApplicationAdminUpdateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const current = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String(current.data.status || '') !== 'pending') {
      return NextResponse.json({ error: 'Immutable' }, { status: 409 });
    }

    const prevMeta = current.data.meta;
    const patchMeta = parsed.data.application.meta;
    const nextMeta = mergeMeta(prevMeta, patchMeta);

    const firstName = String(nextMeta.first_name || '').trim();
    const lastName = String(nextMeta.last_name || '').trim();
    const nextName = `${firstName} ${lastName}`.trim() || String(current.data.name || '').trim() || null;
    const membershipType = String(nextMeta.membership_type || '').trim();
    const fieldOfStudy = String(nextMeta.field_of_study || '').trim();
    const nextFaculty = membershipType === 'regular' ? fieldOfStudy || null : null;

    const up = await rls
      .from('membership_applications_v2')
      .update({
        email: parsed.data.application.email,
        phone: parsed.data.application.phone,
        address: parsed.data.application.address,
        motivation: parsed.data.application.motivation,
        name: nextName,
        faculty: nextFaculty,
        meta: nextMeta,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (up.error) throw up.error;

    const afterRes = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle<MembershipApplicationRow>();
    if (afterRes.error) throw afterRes.error;

    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'membership_application.edit',
      entity: { type: 'membership_application', id },
      before: current.data,
      after: afterRes.data || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
