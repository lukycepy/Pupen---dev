import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplate } from '@/lib/email/templates';

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

async function sendWithConcurrency<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number) {
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
    const { html: wrappedHtml, subject: wrappedSubject } = renderEmailTemplate('newsletter', { subject, html });

    const sendRes = await sendWithConcurrency(
      recipients,
      async (to) => {
        await transporter.sendMail({ from, to, subject: wrappedSubject, html: wrappedHtml });
      },
      5,
    );

    const now = new Date().toISOString();
    await supabase
      .from('newsletter')
      .insert([{ subject, html, sent_at: now }])
      .throwOnError();

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'NEWSLETTER_SENT',
          target_id: null,
          details: { categories, sent: sendRes.ok, failed: sendRes.failed, recipients: recipients.length },
        },
      ])
      .throwOnError();

    return NextResponse.json({ ok: true, sent: sendRes.ok, failed: sendRes.failed, recipients: recipients.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}

