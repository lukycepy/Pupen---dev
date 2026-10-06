import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { buildWeeklyDigest } from '@/lib/email/digest';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

interface PaymentSettingsRow {
  notification_email?: string | null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const digest = await buildWeeklyDigest(supabase);
    return NextResponse.json({ ok: true, digest });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const supabase = getServerSupabase();

    const { data: paymentSettings } = await supabase.from('payment_settings').select('notification_email').maybeSingle();
    const settings = (paymentSettings || null) as PaymentSettingsRow | null;

    const to = settings?.notification_email || user.email || process.env.SMTP_USER;
    if (!to) return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });

    const digest = await buildWeeklyDigest(supabase);

    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'digest_manual' },
      message: { from, to, subject: digest.subject, html: digest.html },
    });

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: user.email || 'admin',
          admin_name: 'Digest',
          action: 'DIGEST_SENT',
          target_id: String(to),
          details: { type: 'manual', to, metrics: digest.metrics, createdAt: new Date().toISOString() },
        },
      ]);
    } catch {}

    return NextResponse.json({ ok: true, to, metrics: digest.metrics });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
