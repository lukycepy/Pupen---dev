import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireAdmin } from '@/lib/server-auth';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const refundLogId = String(body?.refundLogId || '').trim();
    const nextStatus = String(body?.status || '').trim();
    const amount = body?.amount ?? null;
    const currency = String(body?.currency || 'CZK').trim() || 'CZK';
    const note = body?.note ? String(body.note).trim() : '';

    if (!refundLogId) return NextResponse.json({ error: 'Missing refundLogId' }, { status: 400 });
    if (!['open', 'approved', 'denied', 'paid'].includes(nextStatus)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    const supabase = getServerSupabase();
    const reqRow = await supabase.from('admin_logs').select('id, details, created_at').eq('id', refundLogId).maybeSingle();
    if (reqRow.error) throw reqRow.error;
    if (!reqRow.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const d = reqRow.data.details || {};
    const requesterEmail = d?.requester?.email ? String(d.requester.email).toLowerCase() : '';
    const eventTitle = d?.eventTitle ? String(d.eventTitle) : '';
    const rsvpId = d?.rsvpId ? String(d.rsvpId) : '';
    const eventId = d?.eventId ? String(d.eventId) : '';

    const ins = await supabase.from('admin_logs').insert([
      {
        admin_email: user.email || 'admin',
        admin_name: 'Refunds',
        action: 'REFUND_WORKFLOW',
        target_id: refundLogId,
        details: {
          refundLogId,
          status: nextStatus,
          amount: amount == null || amount === '' ? null : amount,
          currency,
          note: note || null,
          rsvpId: rsvpId || null,
          eventId: eventId || null,
          email: requesterEmail || null,
          updatedAt: new Date().toISOString(),
          updatedBy: user.email || null,
        },
      },
    ]);
    if (ins.error) throw ins.error;

    if (requesterEmail && ['approved', 'denied', 'paid'].includes(nextStatus)) {
      try {
        const transporter = await getMailerWithSettings();
        const from = await getSenderFromSettings();

        const { subject, html } = await renderEmailTemplateWithDbOverride('refund_status', {
          toEmail: requesterEmail,
          refundLogId,
          rsvpId,
          eventId,
          eventTitle,
          status: nextStatus,
          amount: amount == null || amount === '' ? null : amount,
          currency,
          note,
        });

        await sendMailWithQueueFallback({
          transporter,
          supabase,
          meta: { kind: 'refund_status' },
          message: { from, to: requesterEmail, subject, html },
        });

        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: user.email || 'admin',
              admin_name: 'Refunds',
              action: 'REFUND_EMAIL_SENT',
              target_id: refundLogId,
              details: { refundLogId, to: requesterEmail, status: nextStatus, createdAt: new Date().toISOString() },
            },
          ]);
        } catch {}
      } catch {}
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
