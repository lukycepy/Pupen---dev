import { getServerSupabase } from '@/lib/supabase-server';

function isSchemaCacheMissingTable(e: any) {
  const msg = String(e?.message || '');
  return msg.includes('Could not find the table') && msg.includes('in the schema cache');
}

export type EmailQueueMeta = {
  kind?: string;
  template_key?: string;
  source?: string;
  [k: string]: any;
};

export type EnqueueEmailInput = {
  to: string;
  from: string;
  subject: string;
  html: string;
  replyTo?: string;
  meta?: EmailQueueMeta;
  maxAttempts?: number;
  lastError?: string;
};

export async function enqueueEmailSend(input: EnqueueEmailInput, supabase?: any) {
  try {
    const sb = supabase || getServerSupabase();
    const res = await sb.from('email_send_queue').insert([
      {
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
      },
    ]);
    if (res.error) throw res.error;
    return { ok: true as const };
  } catch (e: any) {
    if (isSchemaCacheMissingTable(e)) return { ok: false as const, skipped: 'missing_table' as const };
    return { ok: false as const, error: e };
  }
}

export async function sendMailWithQueueFallback(opts: {
  transporter: any;
  message: { from: string; to: string; subject: string; html: string; replyTo?: string; headers?: Record<string, string>; attachments?: any[] };
  meta?: EmailQueueMeta;
  supabase?: any;
}) {
  try {
    await opts.transporter.sendMail({
      from: opts.message.from,
      to: opts.message.to,
      subject: opts.message.subject,
      html: opts.message.html,
      replyTo: opts.message.replyTo || undefined,
      headers: opts.message.headers,
      attachments: opts.message.attachments,
    });
    return { ok: true as const };
  } catch (e: any) {
    const lastError = e?.message ? String(e.message) : String(e);
    const enq = await enqueueEmailSend(
      {
        to: opts.message.to,
        from: opts.message.from,
        replyTo: opts.message.replyTo,
        subject: opts.message.subject,
        html: opts.message.html,
        meta: { ...(opts.meta || {}), last_error: lastError },
        lastError,
      },
      opts.supabase,
    );
    return { ok: false as const, queued: enq.ok === true, error: e, enqueue: enq };
  }
}
