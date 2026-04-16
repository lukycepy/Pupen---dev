import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const supabase = getServerSupabase();

  try {
    const settingsRes = await supabase.from('trust_box_settings').select('retention_days, auto_anonymize').eq('id', 1).maybeSingle();
    if (settingsRes.error) throw settingsRes.error;
    const settings: any = settingsRes.data || {};
    const retentionDays = Number(settings.retention_days || 365);
    const auto = settings.auto_anonymize !== false;
    if (!auto) return NextResponse.json({ ok: true, skipped: 'disabled' });

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60_000).toISOString();

    const thrRes = await supabase
      .from('trust_box_threads')
      .select('id')
      .is('anonymized_at', null)
      .lt('created_at', cutoff)
      .limit(2000);
    if (thrRes.error) throw thrRes.error;
    const ids = (thrRes.data || []).map((x: any) => String(x.id));
    if (!ids.length) {
      const oldV = await supabase
        .from('trust_box_verifications')
        .delete()
        .lt('expires_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString());
      if (oldV.error) throw oldV.error;
      return NextResponse.json({ ok: true, anonymized: 0, cleanedVerifications: true });
    }

    const attRes = await supabase.from('trust_box_attachments').select('bucket,path,thread_id').in('thread_id', ids);
    if (attRes.error) throw attRes.error;
    const byBucket = new Map<string, string[]>();
    for (const a of attRes.data || []) {
      const b = String((a as any).bucket || '');
      const p = String((a as any).path || '');
      if (!b || !p) continue;
      const arr = byBucket.get(b) || [];
      arr.push(p);
      byBucket.set(b, arr);
    }
    for (const [bucket, paths] of byBucket.entries()) {
      for (const part of chunk(paths, 100)) {
        const r = await supabase.storage.from(bucket).remove(part);
        if (r.error) throw r.error;
      }
    }

    const delAtt = await supabase.from('trust_box_attachments').delete().in('thread_id', ids);
    if (delAtt.error) throw delAtt.error;

    const delTokens = await supabase.from('trust_box_access_tokens').delete().in('thread_id', ids);
    if (delTokens.error) throw delTokens.error;

    const delIdent = await supabase.from('trust_box_identities').delete().in('thread_id', ids);
    if (delIdent.error) throw delIdent.error;

    const upd = await supabase
      .from('trust_box_threads')
      .update({ anonymized_at: new Date().toISOString() })
      .in('id', ids);
    if (upd.error) throw upd.error;

    const oldV = await supabase
      .from('trust_box_verifications')
      .delete()
      .lt('expires_at', new Date(Date.now() - 24 * 60 * 60_000).toISOString());
    if (oldV.error) throw oldV.error;

    return NextResponse.json({ ok: true, anonymized: ids.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

