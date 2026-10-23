import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

interface DeadLetterRow {
  to_email?: string | null;
  from_email?: string | null;
  reply_to?: string | null;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  headers?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
  max_attempts?: number | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const deadId = String(id || '').trim();
    if (!deadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = getServerSupabase();
    const row = await supabase.from('email_send_dead_letters').select('*').eq('id', deadId).single<DeadLetterRow>();
    if (row.error) throw row.error;
    const deadLetter = row.data;

    await supabase
      .from('email_send_queue')
      .insert([
        {
          status: 'queued',
          to_email: String(deadLetter?.to_email || ''),
          from_email: String(deadLetter?.from_email || ''),
          reply_to: deadLetter?.reply_to || null,
          subject: String(deadLetter?.subject || ''),
          html: String(deadLetter?.html || ''),
          text: deadLetter?.text ? String(deadLetter.text) : null,
          headers: toRecord(deadLetter?.headers),
          meta: toRecord(deadLetter?.meta),
          attempt_count: 0,
          max_attempts: Number(deadLetter?.max_attempts || 5),
          last_error: null,
          next_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .throwOnError();

    await supabase.from('email_send_dead_letters').delete().eq('id', deadId).throwOnError();
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
