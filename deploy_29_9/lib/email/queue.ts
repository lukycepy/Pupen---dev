import { getServerSupabase } from '@/lib/supabase-server';
import type { Attachment } from 'nodemailer/lib/mailer';

interface QueueIdRow {
  id?: string | number | null;
}

interface QueueInsertRow {
  status: 'queued';
  to_email: string;
  from_email: string;
  reply_to: string | null;
  subject: string;
  html: string;
  meta: EmailQueueMeta;
  last_error: string | null;
  max_attempts: number;
  attempt_count: number;
  next_attempt_at: string;
  updated_at: string;
  text?: string | null;
  headers?: Record<string, string>;
}

interface NormalizedQueueError {
  message: string;
  name: string;
  code: string;
  command: string;
  responseCode: number | null;
  response: string;
  stack: string;
}

interface QueueTransportMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: Attachment[];
}

interface QueueTransporter {
  sendMail(message: QueueTransportMessage, ...args: unknown[]): Promise<unknown> | void;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || '');
}

function isSchemaCacheMissingTable(error: unknown) {
  const msg = errorMessage(error);
  return msg.includes('Could not find the table') && msg.includes('in the schema cache');
}

function isSchemaCacheMissingColumn(error: unknown) {
  const msg = errorMessage(error);
  return msg.includes('in the schema cache') && msg.toLowerCase().includes('column');
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeError(error: unknown): NormalizedQueueError {
  const err = toRecord(error);
  return {
    message: String(err.message || error || ''),
    name: err.name ? String(err.name) : '',
    code: err.code ? String(err.code) : '',
    command: err.command ? String(err.command) : '',
    responseCode: typeof err.responseCode === 'number' ? err.responseCode : null,
    response: err.response ? String(err.response) : '',
    stack: err.stack ? String(err.stack) : '',
  };
}

export type EmailQueueMeta = {
  kind?: string;
  template_key?: string;
  source?: string;
  [k: string]: unknown;
};

export type EnqueueEmailInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  meta?: EmailQueueMeta;
  maxAttempts?: number;
  lastError?: string;
};

export async function enqueueEmailSend(input: EnqueueEmailInput, supabase?: ReturnType<typeof getServerSupabase>) {
  try {
    const sb = supabase || getServerSupabase();
    const base: QueueInsertRow = {
      status: 'queued',
      to_email: input.to,
      from_email: input.from,
      reply_to: input.replyTo || null,
      subject: input.subject,
      html: input.html,
      meta: input.meta || {},
      last_error: input.lastError || null,
      max_attempts: typeof input.maxAttempts === 'number' ? input.maxAttempts : 5,
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    let res = await sb
      .from('email_send_queue')
      .insert([{ ...base, text: input.text || null, headers: input.headers || {} }])
      .select('id')
      .single<QueueIdRow>();
    if (res.error && isSchemaCacheMissingColumn(res.error)) {
      res = await sb.from('email_send_queue').insert([base]).select('id').single<QueueIdRow>();
    }
    if (res.error) throw res.error;
    return { ok: true as const, queueId: res.data?.id ? String(res.data.id) : null };
  } catch (error: unknown) {
    if (isSchemaCacheMissingTable(error)) return { ok: false as const, skipped: 'missing_table' as const };
    return { ok: false as const, error };
  }
}

export async function sendMailWithQueueFallback(opts: {
  transporter: QueueTransporter;
  message: QueueTransportMessage;
  meta?: EmailQueueMeta;
  supabase?: ReturnType<typeof getServerSupabase>;
}) {
  try {
    await opts.transporter.sendMail({
      from: opts.message.from,
      to: opts.message.to,
      subject: opts.message.subject,
      html: opts.message.html,
      text: opts.message.text,
      replyTo: opts.message.replyTo || undefined,
      headers: opts.message.headers,
      attachments: opts.message.attachments,
    });
    return { ok: true as const };
  } catch (error: unknown) {
    const info = normalizeError(error);
    const lastError = info.message;
    const enq = await enqueueEmailSend(
      {
        to: opts.message.to,
        from: opts.message.from,
        replyTo: opts.message.replyTo,
        subject: opts.message.subject,
        html: opts.message.html,
        text: opts.message.text,
        headers: opts.message.headers,
        meta: { ...(opts.meta || {}), last_error: lastError, enqueue_error: info },
        lastError,
      },
      opts.supabase,
    );
    return { ok: false as const, queued: enq.ok === true, error, enqueue: enq };
  }
}
