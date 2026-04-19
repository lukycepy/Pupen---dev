import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicGet, guardPublicJsonPost } from '@/lib/public-post-guard';
import { enqueueEmailSend } from '@/lib/email/queue';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export async function GET(req: Request) {
  try {
    const g = await guardPublicGet(req, { keyPrefix: 'trustbox_thread_get', windowMs: 60_000, max: 120 });
    if (!g.ok) return g.response;
    const url = new URL(req.url);
    const token = String(url.searchParams.get('token') || '').trim();
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

    const supabase = getServerSupabase();
    const tokenHash = sha256Hex(token);
    const tok = await supabase
      .from('trust_box_access_tokens')
      .select('thread_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (tok.error) throw tok.error;
    const row: any = tok.data;
    if (!row) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    const threadRes = await supabase.from('trust_box_threads').select('*').eq('id', row.thread_id).maybeSingle();
    if (threadRes.error) throw threadRes.error;
    const thread: any = threadRes.data;
    if (!thread) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const msgsRes = await supabase
      .from('trust_box_messages')
      .select('id, author_type, author_name, body, created_at')
      .eq('thread_id', row.thread_id)
      .in('author_type', ['reporter', 'admin'])
      .order('created_at', { ascending: true });
    if (msgsRes.error) throw msgsRes.error;

    const atRes = await supabase
      .from('trust_box_attachments')
      .select('id, message_id, original_name, content_type, size_bytes, created_at')
      .eq('thread_id', row.thread_id)
      .order('created_at', { ascending: true });
    if (atRes.error) throw atRes.error;

    return NextResponse.json({
      ok: true,
      thread: {
        id: thread.id,
        status: thread.status,
        priority: thread.priority,
        category: thread.category,
        subject: thread.subject,
        created_at: thread.created_at,
        anonymized_at: thread.anonymized_at,
      },
      messages: msgsRes.data || [],
      attachments: atRes.data || [],
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'trustbox_thread_post',
      windowMs: 60_000,
      max: 30,
      honeypotResponse: { ok: true },
    });
    if (!g.ok) return g.response;
    const body = g.body || {};

    const token = String(body?.token || '').trim();
    const message = String(body?.message || '').trim().slice(0, 10_000);
    if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    if (!message) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

    const supabase = getServerSupabase();
    const tokenHash = sha256Hex(token);
    const tok = await supabase
      .from('trust_box_access_tokens')
      .select('thread_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (tok.error) throw tok.error;
    const row: any = tok.data;
    if (!row) return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    if (new Date(row.expires_at).getTime() < Date.now()) return NextResponse.json({ error: 'Expired' }, { status: 400 });

    const ins = await supabase.from('trust_box_messages').insert([{ thread_id: row.thread_id, author_type: 'reporter', body: message }]);
    if (ins.error) throw ins.error;
    const upd = await supabase.from('trust_box_threads').update({ last_activity_at: new Date().toISOString() }).eq('id', row.thread_id);
    if (upd.error) throw upd.error;

    try {
      const lastAdmin = await supabase
        .from('trust_box_messages')
        .select('author_user_id, author_name, created_at')
        .eq('thread_id', row.thread_id)
        .in('author_type', ['admin', 'internal'])
        .not('author_user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const adminMsg: any = lastAdmin.data || null;
      if (adminMsg?.author_user_id) {
        const profRes = await supabase
          .from('profiles')
          .select('email, first_name, last_name')
          .eq('id', String(adminMsg.author_user_id))
          .maybeSingle();
        const prof: any = profRes.data || null;
        const toEmail = String(prof?.email || '').trim();
        if (toEmail) {
          const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';
          const adminUrl = `${baseUrl}/cs/admin/dashboard#trustbox`;
          const displayName = String(`${prof?.first_name || ''} ${prof?.last_name || ''}`).trim() || toEmail;
          const subject = 'Pupen — Schránka důvěry: nová odpověď nahlašovatele';
          const html = `
            <div style="font-family: sans-serif; padding: 20px; color: #1c1917; max-width: 700px; margin: auto; border: 1px solid #e7e5e4; border-radius: 20px;">
              <h2 style="color: #16a34a; text-align: center;">Nová odpověď ve vlákně</h2>
              <div style="background-color: #f5f5f4; padding: 20px; border-radius: 15px; margin: 20px 0;">
                <p style="margin: 8px 0;">Dobrý den, ${displayName},</p>
                <p style="margin: 8px 0;">Nahlašovatel odpověděl ve vlákně Schránky důvěry.</p>
                <p style="margin: 16px 0;">
                  <a href="${adminUrl}" style="display:inline-block; background:#16a34a; color:#ffffff; text-decoration:none; padding:12px 16px; border-radius:14px; font-weight:900;">
                    Otevřít Pupen Control
                  </a>
                </p>
                <p style="margin:0; font-size: 12px; color:#78716c;">Thread ID: ${String(row.thread_id)}</p>
              </div>
            </div>
          `;
          await enqueueEmailSend(
            {
              to: toEmail,
              from: process.env.EMAIL_FROM || 'Pupen <noreply@pupen.org>',
              subject,
              html,
              meta: { kind: 'trust_box_reporter_reply', threadId: row.thread_id, notifyUserId: String(adminMsg.author_user_id) },
            },
            supabase,
          );
        }
      }
    } catch {}

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
