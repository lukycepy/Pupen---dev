import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings } from '@/lib/email/mailer';

function backoffSeconds(attempt: number) {
  if (attempt <= 1) return 60;
  if (attempt === 2) return 5 * 60;
  if (attempt === 3) return 30 * 60;
  if (attempt === 4) return 2 * 60 * 60;
  return 12 * 60 * 60;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 25)));
  const workerId = `cron:${Math.random().toString(36).slice(2)}:${Date.now().toString(36)}`;
  const supabase = getServerSupabase();

  try {
    const transporter = await getMailerWithSettings();

    const claim = await supabase.rpc('email_queue_claim', { max_rows: limit, worker_id: workerId });
    if (claim.error) throw claim.error;
    const jobs: any[] = Array.isArray(claim.data) ? claim.data : [];
    if (!jobs.length) return NextResponse.json({ ok: true, processed: 0 });

    let ok = 0;
    let retried = 0;
    let dead = 0;

    for (const j of jobs) {
      const id = String(j.id || '');
      const to = String(j.to_email || '');
      const from = String(j.from_email || '');
      const replyTo = j.reply_to ? String(j.reply_to) : '';
      const subject = String(j.subject || '');
      const html = String(j.html || '');
      const attemptCount = Number(j.attempt_count || 0);
      const maxAttempts = Number(j.max_attempts || 5);

      try {
        await transporter.sendMail({
          from,
          to,
          subject,
          html,
          replyTo: replyTo || undefined,
        });
        const del = await supabase.from('email_send_queue').delete().eq('id', id);
        if (del.error) throw del.error;
        ok += 1;
      } catch (e: any) {
        const nextAttempt = attemptCount + 1;
        const errMsg = e?.message || String(e);

        if (nextAttempt >= maxAttempts) {
          try {
            await supabase.from('email_send_dead_letters').insert([
              {
                queue_id: id,
                to_email: to,
                from_email: from,
                reply_to: replyTo || null,
                subject,
                html,
                meta: j.meta || {},
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
            next_attempt_at: nextAt,
            locked_at: null,
            locked_by: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        retried += 1;
      }
    }

    return NextResponse.json({ ok: true, processed: jobs.length, okCount: ok, retried, dead });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
