import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

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

async function sendWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number, delayMs: number = 0) {
  const queue = [...items];
  const results: { ok: number; failed: number } = { ok: 0, failed: 0 };
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }).map(async () => {
    while (queue.length) {
      const item = queue.shift() as T;
      try {
        await worker(item);
        results.ok += 1;
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
    const html = String(body?.html || '').trim();
    const categories = normalizeCategories(body?.categories);

    if (!subject || !html) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const draftId = body?.draftId;

    const supabase = getServerSupabase();
    const subs = await supabase.from('newsletter_subscriptions').select('email,categories,consent').order('created_at', { ascending: false });
    if (subs.error) throw subs.error;

    const recipients = (subs.data || [])
      .filter((s: any) => s?.consent !== false)
      .filter((s: any) => matchesCategories(s?.categories, categories))
      .map((s: any) => String(s.email || '').trim().toLowerCase())
      .filter(Boolean);

    if (!recipients.length) return NextResponse.json({ ok: true, sent: 0, failed: 0 });

    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();
    
    // Získáme URL pro odhlášení
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://pupen.org';

    let queued = 0;
    // Povolíme maximálně 3 paralelní požadavky a po každém e-mailu ve frontě počkáme 100ms
    // Zabrání to rate limitingu od SMTP providera (např. SendGrid, AWS SES, Resend)
    const sendRes = await sendWithConcurrency(
      recipients,
      async (to) => {
        // Přidáme unsubscribe link specifický pro příjemce
        const unsubUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(to)}`;
        const emailVars = { 
          subject, 
          html, 
          unsubLink: unsubUrl 
        };
        
        const { html: wrappedHtml, subject: wrappedSubject } = await renderEmailTemplateWithDbOverride('newsletter', emailVars);
        
        // Přidáme List-Unsubscribe hlavičku
        const r = await sendMailWithQueueFallback({
          transporter,
          supabase,
          meta: { kind: 'newsletter' },
          message: { 
            from, 
            to, 
            subject: wrappedSubject, 
            html: wrappedHtml,
            headers: {
              'List-Unsubscribe': `<${unsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
          },
        });
        if (!r.ok) {
          if (r.queued) {
            queued += 1;
            return;
          }
          throw r.error;
        }
      },
      3,   // concurrency
      100  // delayMs
    );

    const now = new Date().toISOString();
    await supabase
      .from('newsletter')
      .insert([{ subject, html, sent_at: now }])
      .throwOnError();

    if (draftId) {
      await supabase.from('newsletter_drafts').update({ status: 'sent', updated_at: now }).eq('id', draftId);
    }

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'NEWSLETTER_SENT',
          target_id: null,
          details: { categories, sent: sendRes.ok, queued, failed: sendRes.failed, recipients: recipients.length },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, sent: sendRes.ok, queued, failed: sendRes.failed, recipients: recipients.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
