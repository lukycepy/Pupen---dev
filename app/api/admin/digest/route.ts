import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { buildWeeklyDigest } from '@/lib/email/digest';

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const supabase = getServerSupabase();
    const digest = await buildWeeklyDigest(supabase);
    return NextResponse.json({ ok: true, digest });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const supabase = getServerSupabase();

    const { data: paymentSettings } = await supabase.from('payment_settings').select('notification_email').maybeSingle();

    const to = paymentSettings?.notification_email || user.email || process.env.SMTP_USER;
    if (!to) return NextResponse.json({ error: 'Missing recipient' }, { status: 400 });

    const digest = await buildWeeklyDigest(supabase);

    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    await transporter.sendMail({
      from,
      to,
      subject: digest.subject,
      html: digest.html,
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
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
