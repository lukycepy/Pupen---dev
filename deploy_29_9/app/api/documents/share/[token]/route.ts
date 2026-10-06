import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { extractDocumentsPath } from '@/lib/documents/storage';

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const shareToken = String(token || '').trim();
    if (!shareToken) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const supabase = getServerSupabase();
    const docRes = await supabase
      .from('documents')
      .select('id, file_url, share_enabled, share_expires_at, access_level')
      .eq('share_token', shareToken)
      .maybeSingle();
    if (docRes.error) throw docRes.error;
    const doc: any = docRes.data;
    if (!doc?.id || !doc.share_enabled) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (doc.share_expires_at) {
      const exp = new Date(String(doc.share_expires_at));
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const path = extractDocumentsPath(String(doc.file_url || ''));
    if (!path) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const signed = await supabase.storage.from('documents').createSignedUrl(path, 60 * 10);
    if (signed.error) throw signed.error;

    const url = signed.data?.signedUrl;
    if (!url) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.redirect(url);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

