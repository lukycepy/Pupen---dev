import { getServerSupabase } from '@/lib/supabase-server';
import { listEmailTemplates, renderEmailTemplate, type EmailTemplateKey } from '@/lib/email/templates';

interface EmailTemplateDefinition {
  key: EmailTemplateKey;
  variables?: string[] | null;
}

interface EmailTemplateOverrideRow {
  subject?: string | null;
  html?: string | null;
  is_enabled?: boolean | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '');
}

function isSchemaCacheMissingTable(error: unknown) {
  const msg = getErrorMessage(error);
  return msg.includes('Could not find the table') && msg.includes('in the schema cache');
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toStringValue(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function allowedTokenKeys(templateKey: EmailTemplateKey) {
  const t = listEmailTemplates().find((x) => x.key === templateKey) as EmailTemplateDefinition | undefined;
  const keys = Array.isArray(t?.variables) ? t.variables : [];
  return new Set(keys.map((k: any) => String(k)));
}

function allowedRawTokenKeys(templateKey: EmailTemplateKey) {
  if (templateKey === 'newsletter') return new Set(['html']);
  return new Set<string>();
}

function isSafePathSegment(s: string) {
  if (!s) return false;
  const lower = s.toLowerCase();
  if (lower === '__proto__' || lower === 'prototype' || lower === 'constructor') return false;
  return true;
}

function getPathValue(vars: Record<string, unknown>, path: string) {
  const p = String(path || '').trim();
  if (!p) return undefined;
  const parts = p.split('.').filter(Boolean);
  if (!parts.length) return undefined;
  let cur: unknown = vars;
  for (const seg of parts) {
    if (!isSafePathSegment(seg)) return undefined;
    if (cur == null) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function renderTokens(templateKey: EmailTemplateKey, template: string, vars: Record<string, unknown>) {
  const src = String(template ?? '');
  const allowed = allowedTokenKeys(templateKey);
  const rawAllowed = allowedRawTokenKeys(templateKey);
  return src
    .replace(/\{\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}\}/g, (_m, key) => {
      const k = String(key || '');
      if (!allowed.has(k)) return '';
      const v = getPathValue(vars, k);
      if (!rawAllowed.has(k)) return escapeHtml(toStringValue(v));
      return toStringValue(v);
    })
    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
      const k = String(key || '');
      if (!allowed.has(k)) return '';
      const v = getPathValue(vars, k);
      return escapeHtml(toStringValue(v));
    });
}

export async function renderEmailTemplateWithDbOverride(templateKey: EmailTemplateKey, vars: Record<string, unknown>) {
  const templateVars = toRecord(vars);
  try {
    const supabase = getServerSupabase();
    const res = await supabase
      .from('email_template_overrides')
      .select('subject, html, is_enabled')
      .eq('template_key', templateKey)
      .maybeSingle<EmailTemplateOverrideRow>();
    if (res.error) throw res.error;
    const row = res.data;
    if (row?.is_enabled && (row?.subject || row?.html)) {
      return {
        subject: renderTokens(templateKey, String(row.subject || ''), templateVars),
        html: renderTokens(templateKey, String(row.html || ''), templateVars),
      };
    }
  } catch (error: unknown) {
    if (!isSchemaCacheMissingTable(error)) {
      return renderEmailTemplate(templateKey, templateVars);
    }
  }
  return renderEmailTemplate(templateKey, templateVars);
}
