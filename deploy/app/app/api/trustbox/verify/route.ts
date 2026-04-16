import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { getPublicBaseUrl } from '@/lib/public-base-url';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function randomToken() {
  return randomBytes(32).toString('base64url');
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'trustbox_verify',
      windowMs: 60_000,
      max: 20,
      honeypotResponse: { ok: true },
    });
    if (!g.ok) return g.response;
    const body = g.body || {};

    const lang = body?.lang === 'en' ? 'en' : 'cs';
    const token = String(body?.token || '').trim();
    const code = String(body?.code || '').trim();
    if (!token || !code) return NextResponse.json({ error: lang === 'en' ? 'Missing token/code' : 'Chybí token/kód.' }, { status: 400 });

    const supabase = getServerSupabase();
    const tokenHash = sha256Hex(token);
    const codeHash = sha256Hex(code);

    const v = await supabase
      .from('trust_box_verifications')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (v.error) throw v.error;
    const row: any = v.data;
    if (!row || row.verified_at) return NextResponse.json({ error: lang === 'en' ? 'Invalid token' : 'Neplatný token.' }, { status: 400 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: lang === 'en' ? 'Expired' : 'Platnost vypršela.' }, { status: 400 });
    if (String(row.code_hash) !== codeHash) return NextResponse.json({ error: lang === 'en' ? 'Invalid code' : 'Neplatný kód.' }, { status: 400 });

    const draft: any = row.draft || {};
    const category = String(draft?.category || 'other').slice(0, 80) || 'other';
    const subject = String(draft?.subject || '').slice(0, 120);
    const message = String(draft?.message || '').slice(0, 10_000);
    const priority = draft?.priority === 'urgent' ? 'urgent' : 'normal';
    const allowFollowup = draft?.allow_followup === true;
    const allowForwardToFaculty = draft?.allow_forward_to_faculty === true;

    if (!subject || !message) return NextResponse.json({ error: lang === 'en' ? 'Invalid draft' : 'Neplatný podnět.' }, { status: 400 });

    const threadRes = await supabase
      .from('trust_box_threads')
      .insert([
        {
          status: 'new',
          priority,
          category,
          subject,
          allow_followup: allowFollowup,
          allow_forward_to_faculty: allowForwardToFaculty,
        },
      ])
      .select('id')
      .single();
    if (threadRes.error) throw threadRes.error;
    const threadId = threadRes.data?.id;

    const identRes = await supabase.from('trust_box_identities').insert([
      {
        thread_id: threadId,
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        email_type: row.email_type || 'unknown',
      },
    ]);
    if (identRes.error) throw identRes.error;

    const msgRes = await supabase
      .from('trust_box_messages')
      .insert([{ thread_id: threadId, author_type: 'reporter', body: message }])
      .select('id')
      .single();
    if (msgRes.error) throw msgRes.error;
    const messageId = msgRes.data?.id;

    const attRes = await supabase
      .from('trust_box_verification_attachments')
      .select('*')
      .eq('verification_id', row.id);
    if (attRes.error) throw attRes.error;
    const atts: any[] = attRes.data || [];
    if (atts.length) {
      const insAtts = atts.map((a) => ({
        thread_id: threadId,
        message_id: messageId,
        bucket: a.bucket,
        path: a.path,
        original_name: a.original_name,
        content_type: a.content_type,
        size_bytes: a.size_bytes,
      }));
      const aIns = await supabase.from('trust_box_attachments').insert(insAtts);
      if (aIns.error) throw aIns.error;
    }

    let followupToken: string | null = null;
    if (allowFollowup) {
      followupToken = randomToken();
      const tHash = sha256Hex(followupToken);
      const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString();
      const tokIns = await supabase.from('trust_box_access_tokens').insert([
        {
          thread_id: threadId,
          token_hash: tHash,
          expires_at: expiresAt,
        },
      ]);
      if (tokIns.error) throw tokIns.error;
    }

    const upd = await supabase
      .from('trust_box_verifications')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', row.id);
    if (upd.error) throw upd.error;

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    const threadUrl = followupToken ? `${getPublicBaseUrl()}/${lang}/schranka-duvery/ticket?token=${encodeURIComponent(followupToken)}` : '';
    const { subject: emailSubject, html } = await renderEmailTemplateWithDbOverride('trust_box_confirm', {
      toEmail: row.email,
      firstName: row.first_name,
      threadUrl,
      lang,
    });
    try {
      await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'trust_box_confirm', threadId },
        message: { from, to: row.email, subject: emailSubject, html },
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      status: 'created',
      threadId,
      followupToken,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

