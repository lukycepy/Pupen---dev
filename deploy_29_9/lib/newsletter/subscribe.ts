import { createHash, randomBytes } from 'crypto';
import { DEFAULT_NEWSLETTER_DOI_CONFIG, getNewsletterDoiConfigFromAdminLogs } from '@/lib/newsletter/doiConfig';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';

interface NewsletterSubscriptionRow {
  id?: string | number | null;
  email?: string | null;
  categories?: string[] | null;
  consent?: boolean | null;
  preferences?: Record<string, unknown> | null;
  unsubscribed_at?: string | null;
  doi_token_hash?: string | null;
  doi_requested_at?: string | null;
}

type SupabaseClientLike = {
  from: (table: string) => any;
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

export function normalizeNewsletterLang(input: unknown) {
  return asTrimmedString(input) === 'en' ? 'en' : 'cs';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function isMissingColumn(error: unknown) {
  const msg = getErrorMessage(error);
  return /(schema cache|does not exist|column)/i.test(msg);
}

export function normalizeNewsletterEmail(input: unknown) {
  const v = String(input || '').trim().toLowerCase();
  if (v.length > 200) return '';
  return v;
}

export function isNewsletterEmail(input: string) {
  const v = normalizeNewsletterEmail(input);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function normalizeNewsletterCategories(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const cats = Array.from(new Set(arr.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!cats.length) return ['all'];
  if (cats.includes('all')) return ['all'];
  return cats;
}

export interface SubscribeToNewsletterInput {
  supabase: SupabaseClientLike;
  email: string;
  categories?: unknown;
  source?: string;
  lang?: 'cs' | 'en';
  requestUrl: string;
  preferences?: Record<string, unknown>;
}

export async function subscribeToNewsletter(input: SubscribeToNewsletterInput) {
  const supabase = input.supabase;
  const email = normalizeNewsletterEmail(input.email);
  const categories = normalizeNewsletterCategories(input.categories);
  const source = input.source != null ? String(input.source).slice(0, 80) : 'web';
  const lang = normalizeNewsletterLang(input.lang);

  if (!email) throw new Error('Chybí e-mail.');
  if (!isNewsletterEmail(email)) throw new Error('Neplatný e-mail.');

  const nowIso = new Date().toISOString();
  const { config: doiCfg } = await getNewsletterDoiConfigFromAdminLogs(supabase as any).catch(() => ({
    config: DEFAULT_NEWSLETTER_DOI_CONFIG,
    updatedAt: null,
  }));

  const existing = await supabase
    .from('newsletter_subscriptions')
    .select('id,email,categories,consent,preferences,unsubscribed_at,doi_token_hash,doi_requested_at')
    .eq('email', email)
    .limit(1)
    .maybeSingle();
  if (existing.error) throw existing.error;

  const existingData = (existing.data || null) as NewsletterSubscriptionRow | null;
  const finalCategories = input.categories !== undefined ? categories : existingData?.categories || ['all'];
  const prefs = Object.keys(toRecord(input.preferences)).length
    ? toRecord(input.preferences)
    : existingData?.preferences || { marketing: true, transactional: true };
  const existingId = existingData?.id != null ? String(existingData.id) : null;

  if (doiCfg.enabled) {
    const alreadyConfirmed = !!existingId && existingData?.consent === true && !existingData?.unsubscribed_at;
    if (alreadyConfirmed) {
      let up = await supabase
        .from('newsletter_subscriptions')
        .update({ categories: finalCategories, preferences: prefs, consent: true, source, updated_at: nowIso })
        .eq('id', existingId);
      if (up.error && isMissingColumn(up.error)) {
        up = await supabase
          .from('newsletter_subscriptions')
          .update({ categories: finalCategories, preferences: prefs, consent: true, source })
          .eq('id', existingId);
      }
      if (up.error) throw up.error;
      return { ok: true as const, status: 'updated' as const };
    }

    const token = randomBytes(24).toString('base64url');
    const tokenHash = sha256Hex(token);
    const confirmUrl = new URL('/api/newsletter/confirm', input.requestUrl);
    confirmUrl.searchParams.set('token', token);
    confirmUrl.searchParams.set('lang', lang);

    const payload: Record<string, unknown> = {
      categories: finalCategories,
      preferences: prefs,
      consent: false,
      source,
      updated_at: nowIso,
      doi_token_hash: tokenHash,
      doi_requested_at: nowIso,
      unsubscribed_at: null,
    };

    if (existingId) {
      let up = await supabase.from('newsletter_subscriptions').update(payload).eq('id', existingId);
      if (up.error && isMissingColumn(up.error)) {
        const payload2: Record<string, unknown> = { categories: finalCategories, preferences: prefs, consent: false, source };
        up = await supabase.from('newsletter_subscriptions').update(payload2).eq('id', existingId);
      }
      if (up.error) throw up.error;
    } else {
      let ins = await supabase.from('newsletter_subscriptions').insert([{ email, ...payload }]);
      if (ins.error && ins.error.code === '23505') {
        let up = await supabase.from('newsletter_subscriptions').update(payload).eq('email', email);
        if (up.error && isMissingColumn(up.error)) {
          const payload2: Record<string, unknown> = { categories: finalCategories, preferences: prefs, consent: false, source };
          up = await supabase.from('newsletter_subscriptions').update(payload2).eq('email', email);
        }
        if (up.error) throw up.error;
      } else if (ins.error && isMissingColumn(ins.error)) {
        const payload2: Record<string, unknown> = { email, categories: finalCategories, preferences: prefs, consent: false, source };
        ins = await supabase.from('newsletter_subscriptions').insert([payload2]);
        if (ins.error) throw ins.error;
      } else if (ins.error) {
        throw ins.error;
      }
    }

    try {
      const transporter = await getMailerWithSettingsOrQueueTransporter();
      const from = await getSenderFromSettings();
      const { subject, html } = await renderEmailTemplateWithDbOverride('newsletter_doi_confirm', {
        toEmail: email,
        firstName: '',
        confirmUrl: confirmUrl.toString(),
        lang,
      });
      await sendMailWithQueueFallback({
        transporter,
        supabase: supabase as any,
        meta: { kind: 'newsletter_doi_confirm', email },
        message: { from, to: email, subject, html, text: stripHtmlToText(html) },
      });
    } catch {}

    return { ok: true as const, status: 'pending' as const };
  }

  if (existingData?.id) {
    let up = await supabase
      .from('newsletter_subscriptions')
      .update({ categories: finalCategories, preferences: prefs, consent: true, source, updated_at: nowIso })
      .eq('id', existingData.id);
    if (up.error && isMissingColumn(up.error)) {
      up = await supabase
        .from('newsletter_subscriptions')
        .update({ categories: finalCategories, preferences: prefs, consent: true, source })
        .eq('id', existingData.id);
    }
    if (up.error) throw up.error;
    return { ok: true as const, status: 'updated' as const };
  }

  let ins = await supabase.from('newsletter_subscriptions').insert([
    {
      email,
      categories: finalCategories,
      preferences: prefs,
      consent: true,
      source,
      updated_at: nowIso,
    },
  ]);
  if (ins.error && isMissingColumn(ins.error)) {
    ins = await supabase.from('newsletter_subscriptions').insert([
      {
        email,
        categories: finalCategories,
        preferences: prefs,
        consent: true,
        source,
      },
    ]);
  }
  if (ins.error) {
    if (ins.error.code === '23505') {
      let up = await supabase
        .from('newsletter_subscriptions')
        .update({ categories: finalCategories, preferences: prefs, consent: true, source, updated_at: nowIso })
        .eq('email', email);
      if (up.error && isMissingColumn(up.error)) {
        up = await supabase
          .from('newsletter_subscriptions')
          .update({ categories: finalCategories, preferences: prefs, consent: true, source })
          .eq('email', email);
      }
      if (up.error) throw up.error;
      return { ok: true as const, status: 'updated' as const };
    }
    throw ins.error;
  }
  return { ok: true as const, status: 'created' as const };
}
