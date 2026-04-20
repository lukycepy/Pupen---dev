import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { DEFAULT_NEWSLETTER_DOI_CONFIG, getNewsletterDoiConfigFromAdminLogs } from '@/lib/newsletter/doiConfig';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';

function sha256Hex(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function normalizeLang(input: any) {
  return String(input || '').trim() === 'en' ? 'en' : 'cs';
}

function isMissingColumn(e: any) {
  const msg = String(e?.message || '');
  return /(schema cache|does not exist|column)/i.test(msg);
}

function normalizeEmail(input: string) {
  const v = String(input || '').trim().toLowerCase();
  if (v.length > 200) return '';
  return v;
}

function isEmail(input: string) {
  const v = normalizeEmail(input);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function normalizeCategories(input: any): string[] {
  const arr = Array.isArray(input) ? input : [];
  const cats = Array.from(new Set(arr.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!cats.length) return ['all'];
  if (cats.includes('all')) return ['all'];
  return cats;
}

export async function POST(req: Request) {
  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'nl_sub',
      windowMs: 10 * 60_000,
      max: 30,
      honeypotResponse: { ok: true, status: 'created' },
      tooManyMessage: 'Příliš mnoho požadavků, zkuste to později.',
    });
    if (!g.ok) return g.response;
    const body = g.body;

    const email = normalizeEmail(body?.email || '');
    const categories = normalizeCategories(body?.categories);
    const source = body?.source != null ? String(body.source).slice(0, 80) : 'web';
    const lang = normalizeLang(body?.lang || 'cs');

    if (!email) return NextResponse.json({ error: 'Chybí e-mail.' }, { status: 400 });
    if (!isEmail(email)) return NextResponse.json({ error: 'Neplatný e-mail.' }, { status: 400 });

    const supabase = getServerSupabase();
    const nowIso = new Date().toISOString();

    const { config: doiCfg } = await getNewsletterDoiConfigFromAdminLogs(supabase).catch(() => ({
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

    // Pokud uživatel už existuje, ale neposlal nové kategorie, zachováme původní
    const finalCategories = body?.categories ? categories : (existing.data?.categories || ['all']);
    // Preference: "marketing" a "transactional"
    const prefs = body?.preferences || existing.data?.preferences || { marketing: true, transactional: true };
    const existingId = existing.data?.id ? String((existing.data as any).id) : null;

    if (doiCfg.enabled) {
      const alreadyConfirmed = !!existingId && existing.data?.consent === true && !existing.data?.unsubscribed_at;
      if (alreadyConfirmed) {
        let up: any = await supabase
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
        return NextResponse.json({ ok: true, status: 'updated' });
      }

      const token = randomBytes(24).toString('base64url');
      const tokenHash = sha256Hex(token);
      const confirmUrl = new URL('/api/newsletter/confirm', req.url);
      confirmUrl.searchParams.set('token', token);
      confirmUrl.searchParams.set('lang', lang);

      const payload: any = {
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
        let up: any = await supabase.from('newsletter_subscriptions').update(payload).eq('id', existingId);
        if (up.error && isMissingColumn(up.error)) {
          const payload2: any = { categories: finalCategories, preferences: prefs, consent: false, source };
          up = await supabase.from('newsletter_subscriptions').update(payload2).eq('id', existingId);
        }
        if (up.error) throw up.error;
      } else {
        let ins: any = await supabase.from('newsletter_subscriptions').insert([{ email, ...payload }]);
        if (ins.error && ins.error.code === '23505') {
          let up: any = await supabase.from('newsletter_subscriptions').update(payload).eq('email', email);
          if (up.error && isMissingColumn(up.error)) {
            const payload2: any = { categories: finalCategories, preferences: prefs, consent: false, source };
            up = await supabase.from('newsletter_subscriptions').update(payload2).eq('email', email);
          }
          if (up.error) throw up.error;
        } else if (ins.error && isMissingColumn(ins.error)) {
          const payload2: any = { email, categories: finalCategories, preferences: prefs, consent: false, source };
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
          supabase,
          meta: { kind: 'newsletter_doi_confirm', email },
          message: { from, to: email, subject, html, text: stripHtmlToText(html) },
        });
      } catch {}

      return NextResponse.json({ ok: true, status: 'pending' });
    }

    if (existing.data?.id) {
      let up: any = await supabase
        .from('newsletter_subscriptions')
        .update({ categories: finalCategories, preferences: prefs, consent: true, source, updated_at: nowIso })
        .eq('id', existing.data.id);
      if (up.error && isMissingColumn(up.error)) {
        up = await supabase.from('newsletter_subscriptions').update({ categories: finalCategories, preferences: prefs, consent: true, source }).eq('id', existing.data.id);
      }
      if (up.error) throw up.error;
      return NextResponse.json({ ok: true, status: 'updated' });
    }

    let ins: any = await supabase.from('newsletter_subscriptions').insert([
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
        let up: any = await supabase
          .from('newsletter_subscriptions')
          .update({ categories: finalCategories, preferences: prefs, consent: true, source, updated_at: nowIso })
          .eq('email', email);
        if (up.error && isMissingColumn(up.error)) {
          up = await supabase.from('newsletter_subscriptions').update({ categories: finalCategories, preferences: prefs, consent: true, source }).eq('email', email);
        }
        if (up.error) throw up.error;
        return NextResponse.json({ ok: true, status: 'updated' });
      }
      throw ins.error;
    }
    return NextResponse.json({ ok: true, status: 'created' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
