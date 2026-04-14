import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';

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
    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();

    const thrRes = await supabase
      .from('trust_box_threads')
      .select('id,status,priority,category,subject,allow_followup,allow_forward_to_faculty,created_at,last_activity_at,anonymized_at')
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
      .select('id,author_type,body,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (msgsRes.error) throw msgsRes.error;

    const attRes = await supabase
      .from('trust_box_attachments')
      .select('id,message_id,original_name,content_type,size_bytes,created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });
    if (attRes.error) throw attRes.error;

    return NextResponse.json({
      ok: true,
      canViewPii,
      piiAvailable: canViewPii && !thread.anonymized_at,
      thread: { ...thread, reporter },
      messages: msgsRes.data || [],
      attachments: attRes.data || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireTrustBoxAdmin(req);
    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const status = body?.status != null ? normalizeStatus(body.status) : undefined;
    const priority = body?.priority != null ? normalizePriority(body.priority) : undefined;
    const category = body?.category != null ? String(body.category || '').trim().slice(0, 80) : undefined;

    const patch: any = {};
    if (status) patch.status = status;
    if (priority) patch.priority = priority;
    if (typeof category === 'string' && category) patch.category = category;
    patch.last_activity_at = new Date().toISOString();

    const supabase = getServerSupabase();
    const upd = await supabase.from('trust_box_threads').update(patch).eq('id', threadId);
    if (upd.error) throw upd.error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
