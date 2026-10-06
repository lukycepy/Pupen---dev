import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';

interface TrustBoxThreadRow {
  id?: string | number | null;
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  subject?: string | null;
  created_at?: string | null;
  last_activity_at?: string | null;
  anonymized_at?: string | null;
  owner_user_id?: string | null;
}

interface TrustBoxIdentityListRow {
  thread_id?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface TrustBoxOwnerProfileRow {
  id?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

interface TrustBoxOwnerSummary {
  id: string | null;
  email: string | null;
  name: string | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function redactName(first: string | null | undefined, last: string | null | undefined) {
  const f = String(first || '').trim();
  const l = String(last || '').trim();
  const fi = f ? `${f[0]}.` : '';
  const li = l ? `${l[0]}.` : '';
  const out = `${fi} ${li}`.trim();
  return out || '—';
}

function redactEmail(email: string | null | undefined) {
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
      .select('id,status,priority,category,subject,created_at,last_activity_at,anonymized_at,owner_user_id')
      .order('last_activity_at', { ascending: false })
      .limit(200);
    if (threadsRes.error) throw threadsRes.error;
    const threads: TrustBoxThreadRow[] = Array.isArray(threadsRes.data) ? threadsRes.data : [];
    const ids = threads.map((t) => t.id);

    const idMap = new Map<string, TrustBoxIdentityListRow>();
    if (ids.length) {
      const identRes = await supabase
        .from('trust_box_identities')
        .select('thread_id,first_name,last_name,email')
        .in('thread_id', ids);
      if (identRes.error) throw identRes.error;
      for (const r of (identRes.data || []) as TrustBoxIdentityListRow[]) idMap.set(String(r.thread_id), r);
    }

    const out = threads.map((t) => {
      const ident = idMap.get(String(t.id)) || null;
      const reporter = ident
        ? { name: redactName(ident.first_name, ident.last_name), email: redactEmail(ident.email) }
        : { name: '—', email: '—' };
      return { ...t, reporter };
    });

    const ownerIds = Array.from(new Set(out.map((t) => String(t.owner_user_id || '').trim()).filter(Boolean)));
    const ownersById = new Map<string, TrustBoxOwnerSummary>();
    if (ownerIds.length) {
      const oRes = await supabase.from('profiles').select('id,email,first_name,last_name').in('id', ownerIds);
      if (!oRes.error) {
        for (const p of (oRes.data || []) as TrustBoxOwnerProfileRow[]) {
          ownersById.set(String(p.id), {
            id: p.id || null,
            email: p.email || null,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || null,
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      items: out.map((t) => ({ ...t, owner: t.owner_user_id ? ownersById.get(String(t.owner_user_id)) || null : null })),
      canViewPii,
      isSuperadmin,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
