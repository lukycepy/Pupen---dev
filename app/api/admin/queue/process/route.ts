import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings } from '@/lib/email/mailer';

export const runtime = 'nodejs';

function backoffSeconds(attempt: number) {
  if (attempt <= 1) return 60;
  if (attempt === 2) return 5 * 60;
  if (attempt === 3) return 30 * 60;
  if (attempt === 4) return 2 * 60 * 60;
  return 12 * 60 * 60;
}

function normalizeError(e: any) {
  const err = e || {};
  return {
    message: String(err.message || err),
    name: err.name ? String(err.name) : '',
    code: err.code ? String(err.code) : '',
    command: err.command ? String(err.command) : '',
    responseCode: typeof err.responseCode === 'number' ? err.responseCode : null,
    response: err.response ? String(err.response) : '',
    stack: err.stack ? String(err.stack) : '',
  };
}

function isPermanentSmtpError(info: ReturnType<typeof normalizeError>) {
  if (info.code === 'EAUTH') return true;
  if (info.responseCode === 535) return true;
  const m = info.message.toLowerCase();
  if (m.includes('auth') && m.includes('fail')) return true;
  if (m.includes('invalid') && m.includes('login')) return true;
  if (m.includes('invalid smtp port')) return true;
  return false;
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(200, Number(body?.limit || 50)));
    const resetStuck = body?.resetStuck !== false;
    const workerId = String(body?.workerId || `admin-${Date.now()}`);

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();

    if (resetStuck) {
      const stuckIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await supabase
        .from('email_send_queue')
        .update({
          status: 'retry',
          locked_at: null,
          locked_by: null,
          next_attempt_at: nowIso,
          updated_at: nowIso,
        })
        .eq('status', 'processing')
        .lt('locked_at', stuckIso);
    }

    const transporter = await getMailerWithSettings();
    const claim = await supabase.rpc('email_queue_claim', { max_rows: limit, worker_id: workerId });
    if (claim.error) throw claim.error;
    const jobs: any[] = Array.isArray(claim.data) ? claim.data : [];
    if (!jobs.length) return NextResponse.json({ ok: true, processed: 0, okCount: 0, retried: 0, dead: 0 });

    let okCount = 0;
    let retried = 0;
    let dead = 0;

    for (const j of jobs) {
      const id = String(j.id || '');
      const to = String(j.to_email || '').trim();
      const from = String(j.from_email || '').trim();
      const replyTo = String(j.reply_to || '').trim();
      const subject = String(j.subject || '');
      const html = String(j.html || '');
      const text = j.text ? String(j.text) : '';
      const headers = j?.headers && typeof j.headers === 'object' ? j.headers : undefined;
      const attemptCount = Number(j.attempt_count || 0);
      const maxAttempts = Number(j.max_attempts || 5);

      try {
        await transporter.sendMail({
          from,
          to,
          subject,
          html,
          text: text || undefined,
          replyTo: replyTo || undefined,
          headers,
        });
        const del = await supabase.from('email_send_queue').delete().eq('id', id);
        if (del.error) throw del.error;
        okCount += 1;
      } catch (e: any) {
        const nextAttempt = attemptCount + 1;
        const info = normalizeError(e);
        const errMsg = info.message;
        const meta = j?.meta && typeof j.meta === 'object' ? j.meta : {};
        const meta2 = { ...meta, last_error: info };

        if (isPermanentSmtpError(info) || nextAttempt >= maxAttempts) {
          try {
            await supabase.from('email_send_dead_letters').insert([
              {
                queue_id: id,
                to_email: to,
                from_email: from,
                reply_to: replyTo || null,
                subject,
                html,
                text: text || null,
                headers: headers || {},
                meta: meta2,
                attempt_count: nextAttempt,
                max_attempts: maxAttempts,
                final_error: errMsg,
                failed_at: new Date().toISOString(),
              },
            ]);
          } catch {}
          await supabase.from('email_send_queue').delete().eq('id', id);
          dead += 1;
          continue;
        }

        const nextAt = new Date(Date.now() + backoffSeconds(nextAttempt) * 1000).toISOString();
        await supabase
          .from('email_send_queue')
          .update({
            status: 'retry',
            attempt_count: nextAttempt,
            last_error: errMsg,
            meta: meta2,
            next_attempt_at: nextAt,
            locked_at: null,
            locked_by: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        retried += 1;
      }
    }

    return NextResponse.json({ ok: true, processed: jobs.length, okCount, retried, dead });
  } catch (e: any) {
    const msg = String(e?.message || 'Error');
    const status = msg === 'Unauthorized' ? 401 : msg === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
