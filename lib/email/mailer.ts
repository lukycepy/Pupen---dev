import nodemailer from 'nodemailer';
import { getServerSupabase } from '@/lib/supabase-server';

export type MailerConfig = {
  host: string;
  user: string;
  pass: string;
  port?: number;
  secure?: boolean;
};

export function getMailer(config?: MailerConfig) {
  const host = config?.host || process.env.SMTP_HOST;
  const user = config?.user || process.env.SMTP_USER;
  const pass = config?.pass || process.env.SMTP_PASS;
  const port = Number(config?.port ?? process.env.SMTP_PORT) || 587;
  const secure = typeof config?.secure === 'boolean' ? config.secure : process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    throw new Error('Email not configured');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

let cachedSettings:
  | { fetchedAt: number; smtp: MailerConfig | null; senderName: string | null; senderEmail: string | null }
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
  const smtp_secure = typeof data?.smtp_secure === 'boolean' ? data.smtp_secure : String(data?.smtp_secure || '') === 'true';

  const smtp =
    smtp_host && smtp_user && smtp_pass
      ? { host: smtp_host, user: smtp_user, pass: smtp_pass, port: smtp_port, secure: smtp_secure }
      : null;

  cachedSettings = {
    fetchedAt: now,
    smtp,
    senderName: data?.sender_name ? String(data.sender_name) : null,
    senderEmail: data?.sender_email ? String(data.sender_email) : null,
  };
  return cachedSettings;
}

export async function getMailerWithSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  if (settings?.smtp) return getMailer(settings.smtp);
  return getMailer();
}

export async function getSenderFromSettings() {
  const settings = await getEmailSettingsCached().catch(() => null);
  const name = settings?.senderName || 'Pupen.org';
  const email = settings?.senderEmail || 'info@pupen.org';
  return `"${name}" <${email}>`;
}
