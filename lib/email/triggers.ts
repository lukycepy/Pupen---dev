import { getServerSupabase } from '@/lib/supabase-server';
import { enqueueEmailSend } from '@/lib/email/queue';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { getSenderFromSettings } from '@/lib/email/mailer';
import { listEmailTemplates, type EmailTemplateKey } from '@/lib/email/templates';

export type EmailTriggerKey =
  | 'billing_invoice_sent'
  | 'billing_invoice_paid'
  | 'rsvp_abandoned_cart'
  | 'membership_application_received'
  | 'membership_application_new_admin'
  | 'membership_application_status'
  | 'membership_application_status_admin';

export type EmailTriggerDef = {
  triggerKey: EmailTriggerKey;
  label: string;
  defaultTemplateCs: EmailTemplateKey;
  defaultTemplateEn: EmailTemplateKey;
};

export const EMAIL_TRIGGER_DEFS: EmailTriggerDef[] = [
  {
    triggerKey: 'billing_invoice_sent',
    label: 'Faktury: odeslání faktury',
    defaultTemplateCs: 'billing_invoice_sent',
    defaultTemplateEn: 'billing_invoice_sent',
  },
  {
    triggerKey: 'billing_invoice_paid',
    label: 'Faktury: uhrazeno',
    defaultTemplateCs: 'invoice_paid',
    defaultTemplateEn: 'invoice_paid',
  },
  {
    triggerKey: 'rsvp_abandoned_cart',
    label: 'RSVP: pripominka nedokoncene platby',
    defaultTemplateCs: 'rsvp_payment_reminder',
    defaultTemplateEn: 'rsvp_payment_reminder',
  },
  {
    triggerKey: 'membership_application_received',
    label: 'Přihlášky: potvrzení uchazeči',
    defaultTemplateCs: 'application_received',
    defaultTemplateEn: 'application_received',
  },
  {
    triggerKey: 'membership_application_new_admin',
    label: 'Přihlášky: upozornění adminovi',
    defaultTemplateCs: 'application_new_admin',
    defaultTemplateEn: 'application_new_admin',
  },
  {
    triggerKey: 'membership_application_status',
    label: 'Přihlášky: změna stavu (uchazeč)',
    defaultTemplateCs: 'application_status',
    defaultTemplateEn: 'application_status',
  },
  {
    triggerKey: 'membership_application_status_admin',
    label: 'Přihlášky: změna stavu (admin)',
    defaultTemplateCs: 'application_status_admin',
    defaultTemplateEn: 'application_status_admin',
  },
];

function allowedTemplateKeySet() {
  return new Set(listEmailTemplates().map((t) => String(t.key)));
}

function findTriggerDef(triggerKey: string) {
  return EMAIL_TRIGGER_DEFS.find((d) => d.triggerKey === triggerKey) || null;
}

interface EmailTriggerSettingsRow {
  enabled?: boolean | null;
  settings?: Record<string, unknown> | null;
}

interface EnqueueEmailTriggerOptions {
  triggerKey: EmailTriggerKey;
  toEmail: string;
  lang: 'cs' | 'en';
  vars: Record<string, unknown>;
  meta?: Record<string, unknown>;
  headers?: Record<string, string>;
  replyTo?: string;
  supabase?: ReturnType<typeof getServerSupabase>;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getEnqueueError(result: unknown) {
  if (result && typeof result === 'object' && 'error' in result) {
    return (result as { error?: unknown }).error || null;
  }
  return null;
}

export async function getEmailTriggerSettings(triggerKey: EmailTriggerKey, supabase?: ReturnType<typeof getServerSupabase>) {
  const sb = supabase || getServerSupabase();
  const def = findTriggerDef(triggerKey);
  if (!def) {
    return {
      enabled: false,
      templateCs: null as EmailTemplateKey | null,
      templateEn: null as EmailTemplateKey | null,
    };
  }

  try {
    const res = await sb.from('email_trigger_settings').select('enabled, settings').eq('trigger_key', triggerKey).maybeSingle<EmailTriggerSettingsRow>();
    if (res.error) throw res.error;
    const row = res.data;
    const enabled = row?.enabled !== false;
    const settings = toRecord(row?.settings);
    const allowed = allowedTemplateKeySet();
    const cs = String(settings.template_cs || '').trim();
    const en = String(settings.template_en || '').trim();
    const templateCs = (allowed.has(cs) ? (cs as EmailTemplateKey) : def.defaultTemplateCs) as EmailTemplateKey;
    const templateEn = (allowed.has(en) ? (en as EmailTemplateKey) : def.defaultTemplateEn) as EmailTemplateKey;
    return { enabled, templateCs, templateEn };
  } catch {
    return { enabled: true, templateCs: def.defaultTemplateCs, templateEn: def.defaultTemplateEn };
  }
}

export async function resolveEmailTriggerTemplateKey(
  triggerKey: EmailTriggerKey,
  lang: 'cs' | 'en',
  supabase?: ReturnType<typeof getServerSupabase>,
) {
  const def = findTriggerDef(triggerKey);
  if (!def) return null;
  const s = await getEmailTriggerSettings(triggerKey, supabase);
  if (!s.enabled) return null;
  return lang === 'en' ? s.templateEn : s.templateCs;
}

export async function enqueueEmailTrigger(opts: EnqueueEmailTriggerOptions) {
  const sb = opts.supabase || getServerSupabase();
  const templateKey = await resolveEmailTriggerTemplateKey(opts.triggerKey, opts.lang, sb);
  if (!templateKey) return { ok: false as const, skipped: 'disabled' as const };

  const rendered = await renderEmailTemplateWithDbOverride(templateKey, { ...opts.vars, lang: opts.lang });
  const from = await getSenderFromSettings();
  const enq = await enqueueEmailSend(
    {
      to: opts.toEmail,
      from,
      subject: rendered.subject,
      html: rendered.html,
      replyTo: opts.replyTo,
      headers: opts.headers,
      meta: { ...(opts.meta || {}), kind: opts.triggerKey, template_key: templateKey, lang: opts.lang },
    },
    sb,
  );

  if (enq.ok && enq.queueId) {
    try {
      await sb.from('email_audit_logs').insert([
        {
          queue_id: enq.queueId,
          to_email: opts.toEmail,
          from_email: from,
          subject: rendered.subject,
          status: 'queued',
          meta: { ...(opts.meta || {}), kind: opts.triggerKey, template_key: templateKey, lang: opts.lang },
        },
      ]);
    } catch {}
  }

  return enq.ok ? { ok: true as const, queueId: enq.queueId || null, templateKey } : { ok: false as const, error: getEnqueueError(enq) };
}
