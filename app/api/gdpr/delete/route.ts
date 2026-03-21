import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireUser } from '@/lib/server-auth';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { getClientIp, rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const ip = getClientIp(req) || 'unknown';
    const rl = rateLimit({ key: `gdpr_delete:${user.id}:${ip}`, windowMs: 24 * 60 * 60 * 1000, max: 3 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Příliš mnoho požadavků. Zkuste to prosím později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const reason = body?.reason ? String(body.reason).slice(0, 2000) : null;

    const supabase = getServerSupabase();

    const { data: paymentSettings } = await supabase.from('payment_settings').select('notification_email').maybeSingle();

    const toEmail = paymentSettings?.notification_email || process.env.INVOICE_EMAIL || process.env.SMTP_USER || 'info@pupen.org';

    const payload = {
      userId: String(user.id),
      email: String(user.email || ''),
      reason,
      ip,
      createdAt: new Date().toISOString(),
      status: 'open',
    };

    const ins = await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'member',
          admin_name: 'GDPR',
          action: 'GDPR_DELETE_REQUEST',
          target_id: String(user.id),
          details: payload,
        },
      ])
      .select('id')
      .single();
    if (ins.error) throw ins.error;

    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    const subject = `GDPR žádost o smazání: ${user.email || user.id}`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
        <h2 style="color: #16a34a; text-align: center;">GDPR žádost o smazání</h2>
        <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0;">
          <p style="margin: 8px 0;"><strong>Uživatel ID:</strong> ${String(user.id)}</p>
          <p style="margin: 8px 0;"><strong>E-mail:</strong> ${String(user.email || '')}</p>
          <p style="margin: 8px 0;"><strong>IP:</strong> ${String(ip)}</p>
          <p style="margin: 8px 0;"><strong>Log ID:</strong> ${String((ins.data as any)?.id || '')}</p>
          ${reason ? `<hr style="border: none; border-top: 1px solid #e7e5e4; margin: 16px 0;" /><p style="margin: 8px 0;"><strong>Důvod:</strong><br/>${String(reason).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>` : ''}
        </div>
        <p style="font-size: 12px; color: #78716c; text-align: center;">Tento e-mail byl odeslán automaticky systémem Pupen.</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: toEmail,
      replyTo: user.email || undefined,
      subject,
      html,
    });

    return NextResponse.json({ ok: true, requestId: (ins.data as any)?.id || null });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
