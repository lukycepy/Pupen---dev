import nodemailer from 'nodemailer';
import { getServerSupabase } from '@/lib/supabase-server';

export type MailerConfig = {
  host: string;
  user: string;
  pass: string;
  port?: number;
  secure?: boolean;
  tlsRejectUnauthorized?: boolean;
  tlsCaPem?: string;
};

export function getMailerDebugInfo(config?: MailerConfig) {
  const host = config?.host || process.env.SMTP_HOST || '';
  const user = config?.user || process.env.SMTP_USER || '';
  const port = Number(config?.port ?? process.env.SMTP_PORT) || 587;
  const secure =
    typeof config?.secure === 'boolean'
      ? config.secure
      : process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465;
  const tlsRejectUnauthorized =
    typeof config?.tlsRejectUnauthorized === 'boolean'
      ? config.tlsRejectUnauthorized
      : process.env.SMTP_TLS_REJECT_UNAUTHORIZED
        ? process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
        : true;

  return {
    host,
    port,
    secure,
    tlsRejectUnauthorized,
    userHint: user ? `${user.split('@')[0]}@…` : '',
    portHint:
      port === 586
        ? 'Port 586 je neobvyklý (často se používá 587 pro STARTTLS).'
        : port === 993
          ? 'Port 993 je IMAP (ne SMTP). Pro SMTP použij typicky 465 nebo 587.'
        : port === 465
          ? 'Port 465 obvykle vyžaduje secure=true (implicitní TLS).'
          : port === 587
            ? 'Port 587 obvykle používá STARTTLS (secure=false).'
            : '',
  };
}

export function getMailer(config?: MailerConfig) {
  const host = config?.host || process.env.SMTP_HOST;
  const user = config?.user || process.env.SMTP_USER;
  const pass = config?.pass || process.env.SMTP_PASS;
  const port = Number(config?.port ?? process.env.SMTP_PORT) || 587;
  const secure =
    typeof config?.secure === 'boolean'
      ? config.secure
      : process.env.SMTP_SECURE
        ? process.env.SMTP_SECURE === 'true'
        : port === 465;
  const tlsRejectUnauthorized =
    typeof config?.tlsRejectUnauthorized === 'boolean'
      ? config.tlsRejectUnauthorized
      : process.env.SMTP_TLS_REJECT_UNAUTHORIZED
        ? process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false'
        : true;

  const tlsCaPem =
    typeof config?.tlsCaPem === 'string' && config.tlsCaPem.trim()
      ? config.tlsCaPem.trim()
      : process.env.SMTP_TLS_CA_PEM
        ? String(process.env.SMTP_TLS_CA_PEM).trim()
        : '';

  if (!host || !user || !pass) {
    throw new Error('Email not configured');
  }

  if ([993, 995, 143].includes(port)) {
    throw new Error(`Invalid SMTP port ${port}. This is typically an IMAP port. Use 465 or 587.`);
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: tlsRejectUnauthorized, servername: host, ...(tlsCaPem ? { ca: tlsCaPem } : {}) },
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 18_000,
  });
}

let cachedSettings:
  | {
      fetchedAt: number;
      smtp: MailerConfig | null;
      senderName: string | null;
      senderEmail: string | null;
      applicationNotificationEmails: string[] | null;
      applicationNotificationEmailsNew: string[] | null;
      applicationNotificationEmailsStatus: string[] | null;
      dkimSelector: string | null;
    }
  | null = null;

async function getEmailSettingsCached() {
  const now = Date.now();
  if (cachedSettings && now - cachedSettings.fetchedAt < 60_000) return cachedSettings;

  const supabase = getServerSupabase();
  const { data } = await supabase.from('email_settings').select('*').limit(1).maybeSingle();

  const smtp_host = data?.smtp_host ? String(data.smtp_host) : '';
  const smtp_user = data?.smtp_user ? String(data.smtp_user) : '';
  const smtp_pass = data?.smtp_pass ? String(data.smtp_pass) : '';
  const smtp_port = typeof data?.smtp_port === 'number' ? data.smtp_port : Number(data?.smtp_port) || 587;
  const smtp_secure =
    typeof data?.smtp_secure === 'boolean'
      ? data.smtp_secure
      : data?.smtp_secure == null
        ? undefined
        : String(data?.smtp_secure || '') === 'true';

  const smtp_tls_reject_unauthorized =
    typeof (data as any)?.smtp_tls_reject_unauthorized === 'boolean'
      ? (data as any).smtp_tls_reject_unauthorized
      : (data as any)?.smtp_tls_reject_unauthorized == null
        ? undefined
        : String((data as any).smtp_tls_reject_unauthorized || '') === 'true';
  const smtp_tls_ca_pem = (data as any)?.smtp_tls_ca_pem ? String((data as any).smtp_tls_ca_pem) : '';

  const smtp =
    smtp_host && smtp_user && smtp_pass
      ? {
          host: smtp_host,
          user: smtp_user,
          pass: smtp_pass,
          port: smtp_port,
          secure: smtp_secure,
          tlsRejectUnauthorized: smtp_tls_reject_unauthorized,
          tlsCaPem: smtp_tls_ca_pem,
        }
      : null;

  cachedSettings = {
    fetchedAt: now,
    smtp,
    senderName: data?.sender_name ? String(data.sender_name) : null,
    senderEmail: data?.sender_email ? String(data.sender_email) : null,
    applicationNotificationEmails: Array.isArray((data as any)?.application_notification_emails)
      ? (data as any).application_notification_emails.map((x: any) => String(x)).filter(Boolean)
      : null,
    applicationNotificationEmailsNew: Array.isArray((data as any)?.application_notification_emails_new)
      ? (data as any).application_notification_emails_new.map((x: any) => String(x)).filter(Boolean)
      : null,
    applicationNotificationEmailsStatus: Array.isArray((data as any)?.application_notification_emails_status)
      ? (data as any).application_notification_emails_status.map((x: any) => String(x)).filter(Boolean)
      : null,
    dkimSelector: (data as any)?.dkim_selector ? String((data as any).dkim_selector) : null,
  };
  return cachedSettings;
}

export async function getMailerWithSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  if (settings?.smtp) return getMailer(settings.smtp);
  return getMailer();
}

export function createQueueOnlyTransporter(err?: any) {
  const e = err instanceof Error ? err : new Error('Email not configured');
  return {
    sendMail: async () => {
      throw e;
    },
  };
}

export async function getMailerWithSettingsOrQueueTransporter() {
  try {
    return await getMailerWithSettings();
  } catch (e: any) {
    return createQueueOnlyTransporter(e);
  }
}

export async function getMailerDebugInfoWithSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  if (settings?.smtp) return getMailerDebugInfo(settings.smtp);
  return getMailerDebugInfo();
}

export async function getSenderFromSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  const name = settings?.senderName || 'Pupen.org';
  const email = settings?.senderEmail || 'info@pupen.org';
  return `"${name}" <${email}>`;
}

export async function getApplicationNotificationEmailsFromSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  return settings?.applicationNotificationEmails || [];
}

export async function getApplicationNewNotificationEmailsFromSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  return settings?.applicationNotificationEmailsNew || [];
}

export async function getApplicationStatusNotificationEmailsFromSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  return settings?.applicationNotificationEmailsStatus || [];
}

export async function getDkimSelectorFromSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  return settings?.dkimSelector || '';
}
