import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

function stageForDays(daysLeft: number) {
  if (daysLeft < 0) return 'expired';
  if (daysLeft <= 1) return 'd1';
  if (daysLeft <= 7) return 'd7';
  if (daysLeft <= 30) return 'd30';
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 200), 1), 1000);
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    const supabase = getServerSupabase();
    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    const res = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, is_member, member_expires_at, member_expiry_notice_stage')
      .eq('is_member', true)
      .not('member_expires_at', 'is', null)
      .order('member_expires_at', { ascending: true })
      .limit(limit);
    if (res.error) throw res.error;

    const rows = res.data || [];
    let processed = 0;
    let sent = 0;
    let queued = 0;
    let skipped = 0;

    for (const p of rows) {
      processed += 1;
      const email = String((p as any).email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) {
        skipped += 1;
        continue;
      }

      const exp = (p as any).member_expires_at ? new Date(String((p as any).member_expires_at)) : null;
      if (!exp || Number.isNaN(exp.getTime())) {
        skipped += 1;
        continue;
      }

      const daysLeft = (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
      const nextStage = stageForDays(daysLeft);
      if (!nextStage) {
        skipped += 1;
        continue;
      }

      const curStage = (p as any).member_expiry_notice_stage ? String((p as any).member_expiry_notice_stage) : '';
      if (curStage === nextStage) {
        skipped += 1;
        continue;
      }

      const firstName = String((p as any).first_name || '');
      const lang = 'cs';
      const { subject, html } = await renderEmailTemplateWithDbOverride('membership_expiry', {
        toEmail: email,
        firstName,
        expiresAt: exp.toISOString(),
        daysLeft,
        lang,
      });

      const r = await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'membership_expiry', stage: nextStage },
        message: { from, to: email, subject, html },
      });
      if (!r.ok) {
        if (r.queued) queued += 1;
        continue;
      }
      sent += 1;

      await supabase
        .from('profiles')
        .update({ member_expiry_notice_stage: nextStage, member_expiry_notice_at: nowIso })
        .eq('id', (p as any).id);

      await supabase.from('admin_logs').insert([
        {
          admin_email: 'cron',
          admin_name: 'membership-expiry',
          action: 'MEMBERSHIP_EXPIRY_NOTICE',
          target_id: String((p as any).id || ''),
          details: { email, stage: nextStage, member_expires_at: exp.toISOString(), daysLeft },
        },
      ]);
    }

    return NextResponse.json({ ok: true, processed, sent, queued, skipped });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

