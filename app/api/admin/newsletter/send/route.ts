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

export const runtime = 'nodejs';

interface NewsletterSendBody {
  subject?: unknown;
  html?: unknown;
  categories?: unknown;
  roleIds?: unknown;
  attachments?: unknown;
  ab?: unknown;
  draftId?: unknown;
}

interface NewsletterSubscriptionRow {
  email?: string | null;
  categories?: string[] | null;
  consent?: boolean | null;
}

interface UserRoleRow {
  user_id?: string | null;
}

interface ProfileEmailRow {
  email?: string | null;
}

interface NewsletterInsertRow {
  id?: string | number | null;
}

interface AbInput {
  enabled?: unknown;
  subjectA?: unknown;
  subjectB?: unknown;
  split?: unknown;
}

interface AttachmentInput {
  name?: unknown;
  url?: unknown;
}

interface MailAttachment {
  filename: string;
  path: string;
}

function normalizeCategories(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const cats = Array.from(new Set(arr.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!cats.length) return ['all'];
  if (cats.includes('all')) return ['all'];
  return cats;
}

function matchesCategories(subCats: unknown, targetCats: string[]) {
  if (targetCats.includes('all')) return true;
  const c = Array.isArray(subCats) ? subCats.map((x) => String(x || '').trim()) : [];
  if (!c.length) return true;
  if (c.includes('all')) return true;
  return c.some((x) => targetCats.includes(x));
}

function normalizeStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function normalizeAttachment(input: unknown): MailAttachment | null {
  const attachment = input as AttachmentInput;
  const filename = typeof attachment?.name === 'string' ? attachment.name.trim() : '';
  const path = typeof attachment?.url === 'string' ? attachment.url.trim() : '';
  return filename && path ? { filename, path } : null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = body as NewsletterSendBody;
    const ab = (payload.ab && typeof payload.ab === 'object' ? payload.ab : {}) as AbInput;
    const subject = String(payload.subject || '').trim().slice(0, 240);
    const html = sanitizeEmailHtml(String(payload.html || '').trim());
    const categories = normalizeCategories(payload.categories);
    const roleIds = normalizeStringArray(payload.roleIds);
    const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];

    const abEnabled = !!ab.enabled;
    const subjectA = String(ab.subjectA || '').trim().slice(0, 240);
    const subjectB = String(ab.subjectB || '').trim().slice(0, 240);
    const abSplitRaw = Number(ab.split);
    const abSplit = Number.isFinite(abSplitRaw) ? Math.min(90, Math.max(10, Math.round(abSplitRaw))) : 50;

    if (!subject || !html) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (abEnabled && (!subjectA || !subjectB)) return NextResponse.json({ error: 'Missing A/B subjects' }, { status: 400 });

    const draftId = payload.draftId;

    const supabase = getServerSupabase();
    const subs = await supabase.from('newsletter_subscriptions').select('email,categories,consent').order('created_at', { ascending: false });
    if (subs.error) throw subs.error;

    const subscriptions: NewsletterSubscriptionRow[] = Array.isArray(subs.data) ? subs.data : [];
    let recipients = subscriptions
      .filter((subscription) => subscription.consent !== false)
      .filter((subscription) => matchesCategories(subscription.categories, categories))
      .map((subscription) => String(subscription.email || '').trim().toLowerCase())
      .filter(Boolean);

    if (roleIds.length) {
      const rolesRes = await supabase.from('app_user_roles').select('user_id').in('role_id', roleIds);
      if (rolesRes.error) throw rolesRes.error;
      const roleRows: UserRoleRow[] = Array.isArray(rolesRes.data) ? rolesRes.data : [];
      const userIds = Array.from(new Set(roleRows.map((row) => String(row.user_id || '')).filter(Boolean)));
      if (!userIds.length) return NextResponse.json({ ok: true, sent: 0, queued: 0, failed: 0, recipients: 0 });
      const profRes = await supabase.from('profiles').select('email').in('id', userIds);
      if (profRes.error) throw profRes.error;
      const profileRows: ProfileEmailRow[] = Array.isArray(profRes.data) ? profRes.data : [];
      const allowed = new Set(profileRows.map((row) => String(row.email || '').trim().toLowerCase()).filter(Boolean));
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
      .single<NewsletterInsertRow>();
    if (ins.error) throw ins.error;
    const campaignId = String(ins.data?.id || '');

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
            text: stripHtmlToText(trackedHtml),
            replyTo: 'info@pupen.org',
            attachments: attachments
              .map((attachment) => normalizeAttachment(attachment))
              .filter((attachment): attachment is MailAttachment => attachment != null),
            headers: {
              'X-Pupen-Category': 'newsletter',
              'X-Pupen-Campaign': campaignId,
              'List-Unsubscribe': `<${unsubApiUrl}>, <mailto:info@pupen.org?subject=unsubscribe>`,
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
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
