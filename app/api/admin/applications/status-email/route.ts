import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) throw new Error('Forbidden');

    const body = await req.json().catch(() => ({}));
    const applicationId = String(body?.applicationId || body?.id || '').trim();
    const lang = body?.lang === 'en' ? 'en' : 'cs';
    if (!applicationId) return NextResponse.json({ error: 'Missing applicationId' }, { status: 400 });

    const supabase = getServerSupabase();
    const appRes = await supabase.from('applications').select('*').eq('id', applicationId).maybeSingle();
    if (appRes.error) throw appRes.error;
    const app: any = appRes.data;
    if (!app?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const email = String(app?.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    const firstName = String(app?.first_name || String(app?.full_name || app?.name || '').split(' ')[0] || '').trim();
    const status = String(app?.status || 'pending');
    const reason = String(app?.rejection_reason || app?.decision_reason || '').trim();

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    const { subject, html } = await renderEmailTemplateWithDbOverride('application_status', {
      toEmail: email,
      firstName,
      status,
      reason: status === 'rejected' ? reason : '',
      lang,
    });

    const r = await sendMailWithQueueFallback({
      transporter,
      supabase,
      meta: { kind: 'application_status', status },
      message: { from, to: email, subject, html },
    });
    if (!r.ok && !r.queued) throw r.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'APPLICATION_STATUS_EMAIL_SENT',
          target_id: String(applicationId),
          details: { email, status, queued: !r.ok && !!r.queued },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
