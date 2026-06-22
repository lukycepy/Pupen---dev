import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { renderEmailTemplate, type EmailTemplateKey, listEmailTemplates } from '@/lib/email/templates';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toStringValue(v: unknown) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function renderTokens(template: string, vars: Record<string, unknown>) {
  const src = String(template ?? '');
  return src
    .replace(/\{\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}\}/g, (_m, key) => toStringValue(vars[key]))
    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => escapeHtml(toStringValue(vars[key])));
}

function allowedKeys() {
  return new Set<EmailTemplateKey>(listEmailTemplates().map((t) => t.key));
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const rawTemplateKey = String(body.templateKey || body.template_key || '').trim();
    const variables = toRecord(body.variables);
    const draftSubject = typeof body.draftSubject === 'string' ? body.draftSubject : null;
    const draftHtml = typeof body.draftHtml === 'string' ? body.draftHtml : null;

    const allowed = allowedKeys();
    if (!allowed.has(rawTemplateKey as EmailTemplateKey)) return NextResponse.json({ error: 'Invalid template key' }, { status: 400 });
    const templateKey = rawTemplateKey as EmailTemplateKey;

    if (draftSubject != null || draftHtml != null) {
      return NextResponse.json({
        ok: true,
        subject: renderTokens(String(draftSubject || ''), variables),
        html: sanitizeEmailHtml(renderTokens(String(draftHtml || ''), variables)),
        source: 'draft',
      });
    }

    const out = await renderEmailTemplateWithDbOverride(templateKey, variables);
    const def = renderEmailTemplate(templateKey, variables);
    const source = out?.subject === def.subject && out?.html === def.html ? 'default' : 'db';
    return NextResponse.json({ ok: true, ...out, html: sanitizeEmailHtml(out?.html || ''), source });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
