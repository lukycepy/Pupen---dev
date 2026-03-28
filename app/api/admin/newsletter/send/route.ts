import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { addUtmToEmailHtml } from '@/lib/email/utm';
import { sanitizeEmailHtml } from '@/lib/email/sanitize';
import crypto from 'crypto';
import { stripHtmlToText } from '@/lib/richtext-shared';

function normalizeCategories(input: any): string[] {
  const arr = Array.isArray(input) ? input : [];
  const cats = Array.from(new Set(arr.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!cats.length) return ['all'];
  if (cats.includes('all')) return ['all'];
  return cats;
}

function matchesCategories(subCats: any, targetCats: string[]) {
  if (targetCats.includes('all')) return true;
  const c = Array.isArray(subCats) ? subCats.map((x) => String(x || '').trim()) : [];
  if (!c.length) return true;
  if (c.includes('all')) return true;
  return c.some((x) => targetCats.includes(x));
}

async function sendWithConcurrency<T>(
  items: T[],
  worker: (item: T) => Promise<'sent' | 'queued'>,
  concurrency: number,
  delayMs: number = 0,
) {
  const queue = [...items];
  const results: { sent: number; queued: number; failed: number } = { sent: 0, queued: 0, failed: 0 };
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }).map(async () => {
    while (queue.length) {
      const item = queue.shift() as T;
      try {
        const r = await worker(item);
        if (r === 'queued') results.queued += 1;
        else results.sent += 1;
      } catch {
        results.failed += 1;
      }
      if (delayMs > 0 && queue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  });
  await Promise.all(runners);
  return results;
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireAdmin(req);
    if (!profile?.is_admin && !profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const subject = String(body?.subject || '').trim().slice(0, 240);
    const html = sanitizeEmailHtml(String(body?.html || '').trim());
    const categories = normalizeCategories(body?.categories);
    const roleIds = Array.isArray(body?.roleIds) ? body.roleIds.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

    const abEnabled = !!body?.ab?.enabled;
    const subjectA = String(body?.ab?.subjectA || '').trim().slice(0, 240);
    const subjectB = String(body?.ab?.subjectB || '').trim().slice(0, 240);
    const abSplitRaw = Number(body?.ab?.split);
    const abSplit = Number.isFinite(abSplitRaw) ? Math.min(90, Math.max(10, Math.round(abSplitRaw))) : 50;

    if (!subject || !html) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (abEnabled && (!subjectA || !subjectB)) return NextResponse.json({ error: 'Missing A/B subjects' }, { status: 400 });

    const draftId = body?.draftId;

    const supabase = getServerSupabase();
    const subs = await supabase.from('newsletter_subscriptions').select('email,categories,consent').order('created_at', { ascending: false });
    if (subs.error) throw subs.error;

    let recipients = (subs.data || [])
      .filter((s: any) => s?.consent !== false)
      .filter((s: any) => matchesCategories(s?.categories, categories))
      .map((s: any) => String(s.email || '').trim().toLowerCase())
      .filter(Boolean);

    if (roleIds.length) {
      const rolesRes = await supabase.from('app_user_roles').select('user_id').in('role_id', roleIds);
      if (rolesRes.error) throw rolesRes.error;
      const userIds = Array.from(new Set((rolesRes.data || []).map((r: any) => String(r.user_id)).filter(Boolean)));
      if (!userIds.length) return NextResponse.json({ ok: true, sent: 0, queued: 0, failed: 0, recipients: 0 });
      const profRes = await supabase.from('profiles').select('email').in('id', userIds as any);
      if (profRes.error) throw profRes.error;
      const allowed = new Set((profRes.data || []).map((p: any) => String(p.email || '').trim().toLowerCase()).filter(Boolean));
      recipients = recipients.filter((e: string) => allowed.has(e));
    }

    if (!recipients.length) return NextResponse.json({ ok: true, sent: 0, queued: 0, failed: 0, recipients: 0 });

    const transporter = await getMailerWithSettingsOrQueueTransporter();
    const from = await getSenderFromSettings();
    
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';

    const createdAt = new Date().toISOString();
    const ins = await supabase
      .from('newsletter')
      .insert([
        {
          subject: abEnabled ? subjectA : subject,
          html,
          sent_at: null,
          target_count: recipients.length,
          ab_enabled: abEnabled,
          subject_a: abEnabled ? subjectA : null,
          subject_b: abEnabled ? subjectB : null,
          ab_split: abEnabled ? abSplit : 50,
        },
      ])
      .select('id')
      .single();
    if (ins.error) throw ins.error;
    const campaignId = String((ins.data as any)?.id || '');

    // Povolíme maximálně 3 paralelní požadavky a po každém e-mailu ve frontě počkáme 100ms
    // Zabrání to rate limitingu od SMTP providera (např. SendGrid, AWS SES, Resend)
    const sendRes = await sendWithConcurrency(
      recipients,
      async (to) => {
        const variant =
          abEnabled
            ? (() => {
                const h = crypto.createHash('sha256').update(`${campaignId}|${to}`).digest();
                const bucket = h.readUInt32BE(0) % 100;
                return bucket < abSplit ? 'a' : 'b';
              })()
            : '';
        const chosenSubject = abEnabled ? (variant === 'a' ? subjectA : subjectB) : subject;

        const preheader = stripHtmlToText(html).slice(0, 140);
        const unsubPageUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(to)}&n=${encodeURIComponent(campaignId)}${variant ? `&v=${encodeURIComponent(variant)}` : ''}`;
        const unsubApiUrl = `${baseUrl}/api/newsletter/unsubscribe?email=${encodeURIComponent(to)}&reason=one_click&source=list_unsubscribe&n=${encodeURIComponent(campaignId)}${variant ? `&v=${encodeURIComponent(variant)}` : ''}`;
        const preferencesLink = `${baseUrl}/unsubscribe?email=${encodeURIComponent(to)}`;
        const emailVars = { 
          subject: chosenSubject, 
          preheader,
          html, 
          unsubLink: unsubPageUrl,
          preferencesLink,
          variant,
        };
        
        const { html: wrappedHtml, subject: wrappedSubject } = await renderEmailTemplateWithDbOverride('newsletter', emailVars);
        const trackedHtml = addUtmToEmailHtml(wrappedHtml, {
          baseUrl,
          campaign: campaignId,
          source: 'newsletter',
          medium: 'email',
          email: to,
          content: variant ? `subject_${variant}` : '',
          variant,
        });
        
        const r = await sendMailWithQueueFallback({
          transporter,
          supabase,
          meta: { kind: 'newsletter', campaignId, variant },
          message: { 
            from, 
            to, 
            subject: wrappedSubject, 
            html: trackedHtml,
            attachments: attachments
              .map((a: any) => ({ filename: a?.name, path: a?.url }))
              .filter((a: any) => typeof a?.filename === 'string' && a.filename && typeof a?.path === 'string' && a.path),
            headers: {
              'List-Unsubscribe': `<${unsubApiUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
          },
        });
        if (r.ok) return 'sent';
        if (r.queued) return 'queued';
        throw r.error;
      },
      3,   // concurrency
      100  // delayMs
    );

    await supabase.from('newsletter').update({ sent_at: createdAt }).eq('id', campaignId);

    if (draftId) {
      await supabase.from('newsletter_drafts').update({ status: 'sent', updated_at: createdAt }).eq('id', draftId);
    }

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'NEWSLETTER_SENT',
          target_id: campaignId || null,
          details: { categories, roleIds, utmCampaign: campaignId, sent: sendRes.sent, queued: sendRes.queued, failed: sendRes.failed, recipients: recipients.length },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, sent: sendRes.sent, queued: sendRes.queued, failed: sendRes.failed, recipients: recipients.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
