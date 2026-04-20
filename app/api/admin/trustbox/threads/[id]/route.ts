import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

function redactName(first: string, last: string) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  const fi = f ? `${f[0]}.` : '';
  const li = l ? `${l[0]}.` : '';
  const out = `${fi} ${li}`.trim();
  return out || '—';
}

function redactEmail(email: string) {
  const v = String(email || '').trim().toLowerCase();
  const m = v.match(/^([^@]+)@(.+)$/);
  if (!m) return '—';
  const local = m[1] || '';
  const domain = m[2] || '';
  const head = local.slice(0, 2);
  return `${head}***@${domain}`;
}

function normalizeStatus(input: any) {
  const v = String(input || '').trim();
  const allowed = new Set(['new', 'in_review', 'waiting_for_info', 'resolved', 'archived']);
  return allowed.has(v) ? v : null;
}

function normalizePriority(input: any) {
  const v = String(input || '').trim();
  const allowed = new Set(['normal', 'urgent']);
  return allowed.has(v) ? v : null;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    const canViewPii = auth.canViewPii;
    const isSuperadmin = auth.isSuperadmin;
    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();

    const thrRes = await supabase
      .from('trust_box_threads')
      .select('id,status,priority,category,subject,allow_followup,allow_forward_to_faculty,created_at,last_activity_at,anonymized_at,owner_user_id')
      .eq('id', threadId)
      .maybeSingle();
    if (thrRes.error) throw thrRes.error;
    const thread: any = thrRes.data;
    if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    let reporter = { name: '—', email: '—' };
    if (!thread.anonymized_at) {
      const identRes = await supabase
        .from('trust_box_identities')
        .select('first_name,last_name,email')
        .eq('thread_id', threadId)
        .maybeSingle();
      if (identRes.error) throw identRes.error;
      const ident: any = identRes.data;
      if (ident) {
        reporter = { name: redactName(ident.first_name, ident.last_name), email: redactEmail(ident.email) };
      }
    }

    const msgsRes = await supabase
      .from('trust_box_messages')
      .select('id,author_type,author_name,body,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (msgsRes.error) throw msgsRes.error;

    const attRes = await supabase
      .from('trust_box_attachments')
      .select('id,message_id,original_name,content_type,size_bytes,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (attRes.error) throw attRes.error;

    let owner: any = null;
    const ownerId = String(thread.owner_user_id || '').trim();
    if (ownerId) {
      const oRes = await supabase.from('profiles').select('id,email,first_name,last_name').eq('id', ownerId).maybeSingle();
      if (!oRes.error && oRes.data) {
        owner = {
          id: (oRes.data as any).id,
          email: (oRes.data as any).email || null,
          name: `${(oRes.data as any).first_name || ''} ${(oRes.data as any).last_name || ''}`.trim() || (oRes.data as any).email || null,
        };
      }
    }

    return NextResponse.json({
      ok: true,
      canViewPii,
      piiAvailable: isSuperadmin && !thread.anonymized_at,
      thread: { ...thread, reporter, owner },
      messages: msgsRes.data || [],
      attachments: attRes.data || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const supabase = getServerSupabase();

    const beforeRes = await supabase.from('trust_box_threads').select('status,priority,category,owner_user_id').eq('id', threadId).maybeSingle();
    if (beforeRes.error) throw beforeRes.error;
    const before: any = beforeRes.data || {};

    const status = body?.status != null ? normalizeStatus(body.status) : undefined;
    const priority = body?.priority != null ? normalizePriority(body.priority) : undefined;
    const category = body?.category != null ? String(body.category || '').trim().slice(0, 80) : undefined;
    const ownerUserId = body?.owner_user_id !== undefined ? (body.owner_user_id ? String(body.owner_user_id).trim() : null) : undefined;

    const patch: any = {};
    if (status) patch.status = status;
    if (priority) patch.priority = priority;
    if (typeof category === 'string' && category) patch.category = category;
    if (ownerUserId !== undefined) {
      if (ownerUserId) {
        const aRes = await supabase.from('trust_box_admins').select('user_id').eq('user_id', ownerUserId).maybeSingle();
        if (aRes.error) throw aRes.error;
        if (!aRes.data) return NextResponse.json({ error: 'Invalid owner' }, { status: 400 });
        patch.owner_user_id = ownerUserId;
      } else {
        patch.owner_user_id = null;
      }
    }
    patch.last_activity_at = new Date().toISOString();

    const upd = await supabase.from('trust_box_threads').update(patch).eq('id', threadId);
    if (upd.error) throw upd.error;

    const actorEmail = auth.user?.email || null;
    const actorUserId = auth.user?.id || null;
    const changes: Array<{ field: string; from: any; to: any }> = [];
    for (const k of ['status', 'priority', 'category', 'owner_user_id']) {
      if (patch[k] !== undefined && before[k] !== patch[k]) changes.push({ field: k, from: before[k], to: patch[k] });
    }
    for (const c of changes) {
      const reason = `${c.field}: ${String(c.from ?? '—')} → ${String(c.to ?? '—')}`;
      await logTrustBoxAudit({
        req,
        actorEmail,
        actorUserId,
        action: c.field === 'owner_user_id' ? 'ADMIN_ASSIGN_OWNER' : 'ADMIN_THREAD_UPDATE',
        threadId,
        piiAccessed: false,
        reason,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
