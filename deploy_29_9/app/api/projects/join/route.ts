import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const { projectId, message } = body || {};
    if (!projectId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const supabase = getServerSupabase();

    const exists = await supabase.from('admin_logs').select('id').eq('action', 'PROJECT').eq('id', projectId).maybeSingle();
    if (exists.error) throw exists.error;
    if (!exists.data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const details = {
      projectId: String(projectId),
      user: { id: user.id, email: user.email },
      message: message ? String(message) : null,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    const res = await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'member',
          admin_name: 'ProjectJoin',
          action: 'PROJECT:join',
          target_id: String(projectId),
          details,
        },
      ])
      .select('id')
      .single();
    if (res.error) throw res.error;

    return NextResponse.json({ ok: true, id: res.data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: e?.message === 'Unauthorized' ? 401 : 500 });
  }
}

