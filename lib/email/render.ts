import { getServerSupabase } from '@/lib/supabase-server';
import { listEmailTemplates, renderEmailTemplate, type EmailTemplateKey } from '@/lib/email/templates';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
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

function toStringValue(v: any) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function allowedTokenKeys(templateKey: EmailTemplateKey) {
  const t = listEmailTemplates().find((x) => x.key === templateKey);
  const keys = Array.isArray((t as any)?.variables) ? (t as any).variables : [];
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

function getPathValue(vars: any, path: string) {
  const p = String(path || '').trim();
  if (!p) return undefined;
  const parts = p.split('.').filter(Boolean);
  if (!parts.length) return undefined;
  let cur: any = vars;
  for (const seg of parts) {
    if (!isSafePathSegment(seg)) return undefined;
    if (cur == null) return undefined;
    if (typeof cur !== 'object') return undefined;
    cur = (cur as any)[seg];
  }
  return cur;
}

function renderTokens(templateKey: EmailTemplateKey, template: string, vars: any) {
  const src = String(template ?? '');
  const allowed = allowedTokenKeys(templateKey);
  const rawAllowed = allowedRawTokenKeys(templateKey);
  return src
    .replace(/\{\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}\}/g, (_m, key) => {
      const k = String(key || '');
      if (!allowed.has(k)) return '';
      const v = getPathValue(vars || {}, k);
      if (!rawAllowed.has(k)) return escapeHtml(toStringValue(v));
      return toStringValue(v);
    })
    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
      const k = String(key || '');
      if (!allowed.has(k)) return '';
      const v = getPathValue(vars || {}, k);
      return escapeHtml(toStringValue(v));
    });
}

export async function renderEmailTemplateWithDbOverride(templateKey: EmailTemplateKey, vars: any) {
  try {
    const supabase = getServerSupabase();
    const res = await supabase
      .from('email_template_overrides')
      .select('subject, html, is_enabled')
      .eq('template_key', templateKey)
      .maybeSingle();
    if (res.error) throw res.error;
    const row: any = res.data;
    if (row?.is_enabled && (row?.subject || row?.html)) {
      return {
        subject: renderTokens(templateKey, String(row.subject || ''), vars || {}),
        html: renderTokens(templateKey, String(row.html || ''), vars || {}),
      };
    }
  } catch (e: any) {
    if (!isSchemaCacheMissingTable(e)) {
      return renderEmailTemplate(templateKey, vars || {});
    }
  }
  return renderEmailTemplate(templateKey, vars || {});
}
