import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const { title, description, tags } = body || {};

    if (!title || !description) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = getServerSupabase();
    const payload = {
      kind: 'project',
      title: String(title),
      description: String(description),
      tags: Array.isArray(tags) ? tags.map((t: any) => String(t)).slice(0, 12) : [],
      status: 'open',
      createdBy: { id: user.id, email: user.email },
      updatedAt: new Date().toISOString(),
    };

    const res = await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'member',
          admin_name: 'Project',
          action: 'PROJECT',
          target_id: null,
          details: payload,
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

