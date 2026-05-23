import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { membershipApplicationAdminUpdateSchema } from '@/lib/validations/membership-applications-admin';
import { writeAuditLog } from '@/lib/audit/audit-log';

function mergeMeta(prev: any, patch: any) {
  const base = prev && typeof prev === 'object' ? prev : {};
  const p = patch && typeof patch === 'object' ? patch : {};
  const next: any = { ...base };
  for (const [k, v] of Object.entries(p)) {
    if (k === 'pdf_snapshot' && v && typeof v === 'object') {
      const prevSnap = next.pdf_snapshot && typeof next.pdf_snapshot === 'object' ? next.pdf_snapshot : {};
      next.pdf_snapshot = { ...prevSnap, ...(v as any) };
      continue;
    }
    next[k] = v;
  }
  return next;
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

    const appRes = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle();
    if (appRes.error) throw appRes.error;
    if (!appRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const filesRes = await rls
      .from('membership_application_files')
      .select('id,created_at,file_name,mime_type,size_bytes,meta')
      .eq('application_id', id)
      .order('created_at', { ascending: false });
    if (filesRes.error) throw filesRes.error;

    return NextResponse.json({ ok: true, application: appRes.data, files: filesRes.data || [] });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
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

    const current = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String((current.data as any).status || '') !== 'pending') {
      return NextResponse.json({ error: 'Immutable' }, { status: 409 });
    }

    const prevMeta = (current.data as any).meta;
    const patchMeta = parsed.data.application.meta;
    const nextMeta = mergeMeta(prevMeta, patchMeta);

    const firstName = String(nextMeta?.first_name || '').trim();
    const lastName = String(nextMeta?.last_name || '').trim();
    const nextName = `${firstName} ${lastName}`.trim() || String((current.data as any).name || '').trim() || null;
    const membershipType = String(nextMeta?.membership_type || '').trim();
    const fieldOfStudy = String(nextMeta?.field_of_study || '').trim();
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

    const afterRes = await rls.from('membership_applications_v2').select('*').eq('id', id).maybeSingle();
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
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
