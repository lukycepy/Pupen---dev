import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { extractDocumentsPath } from '@/lib/documents/storage';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const documentId = String(body?.documentId || body?.document_id || body?.id || '').trim();
    if (!documentId) return NextResponse.json({ error: 'Missing documentId' }, { status: 400 });

    const supabase = getServerSupabase();
    const docRes = await supabase
      .from('documents')
      .select('id, file_url, access_level, is_member_only, share_enabled')
      .eq('id', documentId)
      .maybeSingle();
    if (docRes.error) throw docRes.error;
    const doc: any = docRes.data;
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('is_admin, is_member, can_view_member_portal, can_edit_member_portal')
      .eq('id', user.id)
      .maybeSingle();
    if (profErr) throw profErr;
    const isMember = !!(profile?.is_member || profile?.is_admin || profile?.can_view_member_portal || profile?.can_edit_member_portal);
    const isAdmin = !!profile?.is_admin;

    const accessLevel = doc.access_level ? String(doc.access_level) : doc.is_member_only ? 'member' : 'public';
    if (accessLevel === 'admin' && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (accessLevel === 'member' && !isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const path = extractDocumentsPath(String(doc.file_url || ''));
    if (!path) return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    const signed = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10);
    if (signed.error) throw signed.error;
    return NextResponse.json({ ok: true, url: signed.data?.signedUrl });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

