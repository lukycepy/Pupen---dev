import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getEmailTemplateDefaultSource, listEmailTemplates } from '@/lib/email/templates';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const key = String(url.searchParams.get('key') || '').trim();
    const allowed = new Set(listEmailTemplates().map((t) => t.key));
    if (!allowed.has(key as any)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

    const out = getEmailTemplateDefaultSource(key as any);
    return NextResponse.json({ ok: true, subject: out.subject, html: out.html });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

