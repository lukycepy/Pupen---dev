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

export async function GET(req: Request) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    const canViewPii = auth.canViewPii;
    const isSuperadmin = auth.isSuperadmin;
    const supabase = getServerSupabase();

    const threadsRes = await supabase
      .from('trust_box_threads')
      .select('id,status,priority,category,subject,created_at,last_activity_at,anonymized_at')
      .order('last_activity_at', { ascending: false })
      .limit(200);
    if (threadsRes.error) throw threadsRes.error;
    const threads: any[] = threadsRes.data || [];
    const ids = threads.map((t) => t.id);

    const idMap = new Map<string, any>();
    if (ids.length) {
      const identRes = await supabase
        .from('trust_box_identities')
        .select('thread_id,first_name,last_name,email')
        .in('thread_id', ids);
      if (identRes.error) throw identRes.error;
      for (const r of identRes.data || []) idMap.set(String((r as any).thread_id), r);
    }

    const out = threads.map((t) => {
      const ident: any = idMap.get(String(t.id)) || null;
      const reporter = ident
        ? canViewPii
          ? { name: `${ident.first_name} ${ident.last_name}`.trim(), email: ident.email }
          : { name: redactName(ident.first_name, ident.last_name), email: redactEmail(ident.email) }
        : { name: '—', email: '—' };
      return { ...t, reporter };
    });

    return NextResponse.json({ ok: true, items: out, canViewPii, isSuperadmin });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
