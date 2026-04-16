import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';
import { getPublicBaseUrl } from '@/lib/public-base-url';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { logTrustBoxAudit } from '@/lib/trustbox/audit';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function randomToken() {
  return randomBytes(32).toString('base64url');
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    const { id } = await params;
    const threadId = String(id || '').trim();
    if (!threadId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const kind = body?.kind === 'internal' ? 'internal' : 'admin';
    const text = String(body?.message || '').trim().slice(0, 10_000);
    const notify = body?.notify === true;
    if (!text) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

    const supabase = getServerSupabase();
    const thrRes = await supabase
      .from('trust_box_threads')
      .select('id,allow_followup,anonymized_at')
      .eq('id', threadId)
      .maybeSingle();
    if (thrRes.error) throw thrRes.error;
    const thread: any = thrRes.data;
    if (!thread?.id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const profRes = await supabase.from('profiles').select('first_name,last_name').eq('id', auth.user.id).maybeSingle();
    const prof: any = profRes.data || null;
    const authorName = String(`${prof?.first_name || ''} ${prof?.last_name || ''}`).trim() || auth.user.email || 'Admin';

    const ins = await supabase
      .from('trust_box_messages')
      .insert([{ thread_id: threadId, author_type: kind, body: text, author_user_id: auth.user.id, author_name: authorName }]);
    if (ins.error) throw ins.error;
    const upd = await supabase.from('trust_box_threads').update({ last_activity_at: new Date().toISOString() }).eq('id', threadId);
    if (upd.error) throw upd.error;

    await logTrustBoxAudit({
      req,
      actorUserId: auth.user.id,
      actorEmail: auth.user.email || null,
      action: 'ADMIN_MESSAGE_SENT',
      threadId,
      piiAccessed: kind === 'admin' && notify === true,
      reason: kind,
    });

    if (kind === 'admin' && notify && thread.allow_followup === true && !thread.anonymized_at) {
      const identRes = await supabase.from('trust_box_identities').select('first_name,email').eq('thread_id', threadId).maybeSingle();
      if (identRes.error) throw identRes.error;
      const ident: any = identRes.data;
      if (ident?.email) {
        const token = randomToken();
        const tokenHash = sha256Hex(token);
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString();
        const tokIns = await supabase.from('trust_box_access_tokens').insert([
          { thread_id: threadId, token_hash: tokenHash, expires_at: expiresAt },
        ]);
        if (tokIns.error) throw tokIns.error;

        const threadUrl = `${getPublicBaseUrl()}/cs/schranka-duvery/ticket?token=${encodeURIComponent(token)}`;
        const transporter = await getMailerWithSettingsOrQueueTransporter();
        const from = await getSenderFromSettings();
        const { subject, html } = await renderEmailTemplateWithDbOverride('trust_box_admin_reply', {
          toEmail: ident.email,
          firstName: ident.first_name || '',
          threadUrl,
          authorName,
          lang: 'cs',
        });
        try {
          await sendMailWithQueueFallback({
            transporter,
            supabase,
            meta: { kind: 'trust_box_admin_reply', threadId },
            message: { from, to: ident.email, subject, html },
          });
        } catch {}
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
