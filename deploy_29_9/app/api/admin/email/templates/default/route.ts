import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getEmailTemplateDefaultSource, listEmailTemplates, type EmailTemplateKey } from '@/lib/email/templates';

export const runtime = 'nodejs';

const EMAIL_TEMPLATE_KEYS = new Set<EmailTemplateKey>(listEmailTemplates().map((template) => template.key));

function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return EMAIL_TEMPLATE_KEYS.has(value as EmailTemplateKey);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const url = new URL(req.url);
    const key = String(url.searchParams.get('key') || '').trim();
    if (!isEmailTemplateKey(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });

    const out = getEmailTemplateDefaultSource(key);
    return NextResponse.json({ ok: true, subject: out.subject, html: out.html });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
