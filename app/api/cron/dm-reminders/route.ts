import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { enqueueEmailSend } from '@/lib/email/queue';

function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return false;
  const got = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  return got === secret;
}

function pickStage(days: number, count: number) {
  if (count >= 3) return null;
  if (days >= 7 && count === 2) return 3;
  if (days >= 3 && count === 1) return 2;
  if (days >= 1 && count === 0) return 1;
  return null;
}

export async function POST(req: Request) {
  try {
    if (!requireCron(req)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const supabase = getServerSupabase();

    const threadsRes = await supabase
      .from('dm_threads')
      .select('id, participant1_id, participant2_id, participant1_email, participant2_email, participant1_unread_count, participant2_unread_count, updated_at')
      .or('participant1_unread_count.gt.0,participant2_unread_count.gt.0')
      .limit(5000);
    if (threadsRes.error) throw threadsRes.error;

    const now = Date.now();
    let scanned = 0;
    let enqueued = 0;

    for (const t of threadsRes.data || []) {
      scanned += 1;
      const updatedAt = new Date(t.updated_at || '').getTime();
      if (!updatedAt || Number.isNaN(updatedAt)) continue;

      const sides: Array<{ userId: string; email: string; unread: number }> = [];
      if (Number(t.participant1_unread_count || 0) > 0 && t.participant1_id && t.participant1_email) {
        sides.push({ userId: t.participant1_id, email: t.participant1_email, unread: Number(t.participant1_unread_count || 0) });
      }
      if (Number(t.participant2_unread_count || 0) > 0 && t.participant2_id && t.participant2_email) {
        sides.push({ userId: t.participant2_id, email: t.participant2_email, unread: Number(t.participant2_unread_count || 0) });
      }

      for (const side of sides) {
        const remRes = await supabase
          .from('dm_unread_reminders')
          .select('first_unread_at, reminder_count, last_reminded_at')
          .eq('thread_id', t.id)
          .eq('user_id', side.userId)
          .maybeSingle();
        if (remRes.error) throw remRes.error;

        const existing = remRes.data || null;
        const firstUnreadAt = existing?.first_unread_at ? new Date(existing.first_unread_at).getTime() : updatedAt;
        const count = Number(existing?.reminder_count || 0);
        const days = Math.floor((now - firstUnreadAt) / (24 * 60 * 60 * 1000));
        const stage = pickStage(days, count);
        if (!stage) {
          if (!existing) {
            await supabase
              .from('dm_unread_reminders')
              .upsert([{ thread_id: t.id, user_id: side.userId, first_unread_at: new Date(firstUnreadAt).toISOString(), updated_at: new Date().toISOString() }])
              .throwOnError();
          }
          continue;
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
        const link = `${baseUrl}/cs/clen`;
        const subject = `Pupen: máte nepřečtené zprávy (${side.unread})`;
        const html = `
          <div style="font-family: ui-sans-serif, system-ui; line-height: 1.5;">
            <h2 style="margin:0 0 12px 0;">Máte nepřečtené zprávy</h2>
            <p style="margin:0 0 12px 0;">V členské sekci na vás čeká ${side.unread} nepřečtených zpráv.</p>
            <p style="margin:0 0 12px 0;">
              <a href="${link}" style="display:inline-block;padding:10px 14px;background:#111827;color:#fff;text-decoration:none;border-radius:12px;font-weight:700;">
                Otevřít členskou sekci
              </a>
            </p>
            <p style="margin:0;color:#6b7280;font-size:12px;">Upozornění ${stage}/3 (1 den, 3 dny, 7 dní).</p>
          </div>
        `;

        const meta = { kind: 'dm_reminder', threadId: t.id, userId: side.userId, stage, unread: side.unread };
        const already = await supabase
          .from('email_send_queue')
          .select('id')
          .contains('meta', meta)
          .limit(1);
        if (!already.error && (already.data || []).length > 0) continue;

        await enqueueEmailSend(
          {
            to: side.email,
            from: process.env.EMAIL_FROM || 'Pupen <noreply@pupen.org>',
            subject,
            html,
            meta,
          },
          supabase,
        );

        await supabase
          .from('dm_unread_reminders')
          .upsert([
            {
              thread_id: t.id,
              user_id: side.userId,
              first_unread_at: new Date(firstUnreadAt).toISOString(),
              reminder_count: Math.min(3, count + 1),
              last_reminded_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .throwOnError();

        enqueued += 1;
      }
    }

    return NextResponse.json({ ok: true, scanned, enqueued }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
