import nodemailer from 'nodemailer';

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
