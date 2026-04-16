import { getServerSupabase } from '@/lib/supabase-server';
import { renderEmailTemplate, type EmailTemplateKey } from '@/lib/email/templates';

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

function renderTokens(template: string, vars: any) {
  const src = String(template ?? '');
  return src
    .replace(/\{\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}\}/g, (_m, key) => {
      const v = vars?.[key];
      return toStringValue(v);
    })
    .replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
      const v = vars?.[key];
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
        subject: renderTokens(String(row.subject || ''), vars || {}),
        html: renderTokens(String(row.html || ''), vars || {}),
      };
    }
  } catch (e: any) {
    if (!isSchemaCacheMissingTable(e)) {
      return renderEmailTemplate(templateKey, vars || {});
    }
  }
  return renderEmailTemplate(templateKey, vars || {});
}

