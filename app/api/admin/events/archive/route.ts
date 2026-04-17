import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';

function yearFromIso(iso: string) {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  return Number.isFinite(y) ? y : new Date().getUTCFullYear();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || 'archive');
    const ids = Array.isArray(body?.ids) ? body.ids.map((x: any) => String(x || '').trim()).filter(Boolean) : [];

    const supabase = getServerSupabase();
    const user = await requireUser(req);
    const profRes = await supabase.from('profiles').select('can_manage_admins, can_edit_events').eq('id', user.id).maybeSingle();
    if (profRes.error) throw profRes.error;
    const profile = profRes.data as any;
    if (!profile?.can_manage_admins && !profile?.can_edit_events) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const nowIso = new Date().toISOString();

    if (mode === 'archive_past') {
      const { data: evs, error } = await supabase
        .from('events')
        .select('id,title,title_en,description,description_en,date,end_date,archived_at')
        .is('archived_at', null)
        .lt('date', nowIso)
        .limit(5000);
      if (error) throw error;
      const eventIds = (evs || []).map((e: any) => e.id);
      if (!eventIds.length) return NextResponse.json({ ok: true, archived: 0 });

      const up = await supabase.from('events').update({ archived_at: nowIso }).in('id', eventIds);
      if (up.error) throw up.error;

      const rows = (evs || []).map((e: any) => ({
        source_event_id: e.id,
        year: yearFromIso(e.end_date || e.date),
        title: e.title,
        title_en: e.title_en || null,
        description: e.description || null,
        description_en: e.description_en || null,
      }));
      const a = await supabase.from('activity_archive').upsert(rows as any, { onConflict: 'source_event_id' } as any);
      if (a.error) throw a.error;

      return NextResponse.json({ ok: true, archived: eventIds.length });
    }

    if (!ids.length) return NextResponse.json({ error: 'No ids' }, { status: 400 });

    if (mode === 'restore') {
      const up = await supabase.from('events').update({ archived_at: null }).in('id', ids);
      if (up.error) throw up.error;
      const del = await supabase.from('activity_archive').delete().in('source_event_id', ids);
      if (del.error) throw del.error;
      return NextResponse.json({ ok: true, restored: ids.length });
    }

    const { data: evs, error } = await supabase
      .from('events')
      .select('id,title,title_en,description,description_en,date,end_date')
      .in('id', ids);
    if (error) throw error;

    const up = await supabase.from('events').update({ archived_at: nowIso }).in('id', ids);
    if (up.error) throw up.error;

    const rows = (evs || []).map((e: any) => ({
      source_event_id: e.id,
      year: yearFromIso(e.end_date || e.date),
      title: e.title,
      title_en: e.title_en || null,
      description: e.description || null,
      description_en: e.description_en || null,
    }));
    const a = await supabase.from('activity_archive').upsert(rows as any, { onConflict: 'source_event_id' } as any);
    if (a.error) throw a.error;

    return NextResponse.json({ ok: true, archived: ids.length });
  } catch (error: any) {
    const msg = String(error?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
