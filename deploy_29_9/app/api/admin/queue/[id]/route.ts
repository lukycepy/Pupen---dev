import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface QueuePatchBody {
  status?: unknown;
  to_email?: unknown;
  from_email?: unknown;
  reply_to?: unknown;
  subject?: unknown;
  max_attempts?: unknown;
  next_attempt_at?: unknown;
  unlock?: unknown;
}

interface QueuePatchPayload {
  status?: unknown;
  to_email?: unknown;
  from_email?: unknown;
  reply_to?: unknown;
  subject?: unknown;
  max_attempts?: unknown;
  next_attempt_at?: unknown;
  locked_at?: null;
  locked_by?: null;
  updated_at: string;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const queueId = String(id || '').trim();
    if (!queueId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase.from('email_send_queue').select('*').eq('id', queueId).maybeSingle();
    if (res.error) throw res.error;
    if (!res.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, item: res.data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const queueId = String(id || '').trim();
    if (!queueId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = toRecord(await req.json().catch(() => ({}))) as QueuePatchBody;
    const patch: QueuePatchPayload = {
      updated_at: new Date().toISOString(),
    };

    if (Object.prototype.hasOwnProperty.call(body, 'status')) patch.status = body.status;
    if (Object.prototype.hasOwnProperty.call(body, 'to_email')) patch.to_email = body.to_email;
    if (Object.prototype.hasOwnProperty.call(body, 'from_email')) patch.from_email = body.from_email;
    if (Object.prototype.hasOwnProperty.call(body, 'reply_to')) patch.reply_to = body.reply_to;
    if (Object.prototype.hasOwnProperty.call(body, 'subject')) patch.subject = body.subject;
    if (Object.prototype.hasOwnProperty.call(body, 'max_attempts')) patch.max_attempts = body.max_attempts;
    if (Object.prototype.hasOwnProperty.call(body, 'next_attempt_at')) patch.next_attempt_at = body.next_attempt_at;

    if (body.unlock === true) {
      patch.locked_at = null;
      patch.locked_by = null;
    }

    const supabase = getServerSupabase();
    const res = await supabase.from('email_send_queue').update(patch).eq('id', queueId);
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const queueId = String(id || '').trim();
    if (!queueId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const res = await supabase.from('email_send_queue').delete().eq('id', queueId);
    if (res.error) throw res.error;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
