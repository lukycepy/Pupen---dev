import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getDkimSelectorFromSettings } from '@/lib/email/mailer';
import dns from 'node:dns/promises';

export const runtime = 'nodejs';

async function resolveTxtSafe(name: string) {
  try {
    const rows = await dns.resolveTxt(name);
    return rows.map((r) => r.join('')).filter(Boolean);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();
    const { data } = await supabase.from('email_settings').select('sender_email').limit(1).maybeSingle();
    const senderEmail = String((data as any)?.sender_email || '').trim();
    const domain = senderEmail.includes('@') ? String(senderEmail.split('@').pop() || '').trim().toLowerCase() : '';
    if (!domain) return NextResponse.json({ error: 'Chybí sender_email pro určení domény.' }, { status: 400 });

    const spfTxt = await resolveTxtSafe(domain);
    const dmarcTxt = await resolveTxtSafe(`_dmarc.${domain}`);

    const selector = String((await getDkimSelectorFromSettings().catch(() => '')) || '').trim();
    const dkimName = selector ? `${selector}._domainkey.${domain}` : '';
    const dkimTxt = dkimName ? await resolveTxtSafe(dkimName) : [];

    const spfOk = spfTxt.some((t) => t.toLowerCase().includes('v=spf1'));
    const dmarcOk = dmarcTxt.some((t) => t.toLowerCase().includes('v=dmarc1'));
    const dkimOk = selector ? dkimTxt.length > 0 : false;

    return NextResponse.json({
      ok: true,
      domain,
      spf: { ok: spfOk, records: spfTxt },
      dmarc: { ok: dmarcOk, records: dmarcTxt },
      dkim: { ok: dkimOk, selector, name: dkimName, records: dkimTxt },
    });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

