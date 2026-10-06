import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireMember } from '@/lib/server-auth';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

interface DmBlockBody {
  threadId?: unknown;
  action?: unknown;
}

interface DmBlockThreadRow {
  participant1_id?: string | null;
  participant2_id?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { user } = await requireMember(req);
    const g = await guardPublicJsonPost(req, {
      keyPrefix: `dm_block:${user.id}`,
      windowMs: 10 * 60 * 1000,
      max: 30,
      honeypot: false,
      tooManyMessage: 'Příliš mnoho požadavků. Zkuste to prosím později.',
    });
    if (!g.ok) return g.response;
    const body = toRecord(g.body) as DmBlockBody;
    const { threadId, action } = body;

    if (!threadId || !action) {
      return NextResponse.json({ error: 'Missing threadId or action' }, { status: 400 });
    }

    if (action !== 'block' && action !== 'unblock') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = getServerSupabase();

    const { data: threadData, error: threadErr } = await supabase
      .from('dm_threads')
      .select('*')
      .eq('id', threadId)
      .single();

    if (threadErr || !threadData) {
      return NextResponse.json({ error: 'Thread not found or tables not migrated yet' }, { status: 404 });
    }

    const thread = threadData as DmBlockThreadRow;
    const isP1 = thread.participant1_id === user.id;
    const isP2 = thread.participant2_id === user.id;

    if (!isP1 && !isP2) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isBlocked = action === 'block';
    const blockedBy = isBlocked ? user.id : null;

    const { error: updateErr } = await supabase
      .from('dm_threads')
      .update({ is_blocked: isBlocked, blocked_by: blockedBy })
      .eq('id', threadId);

    if (updateErr) throw updateErr;

    await supabase.from('admin_logs').insert([{
      admin_email: user.email || 'member',
      admin_name: 'System',
      action: isBlocked ? 'DM_BLOCK' : 'DM_UNBLOCK',
      target_id: threadId,
      details: { threadId, by: user.id }
    }]);

    return NextResponse.json({ ok: true, isBlocked });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
