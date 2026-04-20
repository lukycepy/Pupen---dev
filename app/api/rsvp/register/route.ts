import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getBearerToken } from '@/lib/server-auth';
import { isEmailBlacklisted } from '@/lib/tickets/blacklist';
import { normalizePromoCode } from '@/lib/promo/rules';
import { DEFAULT_TICKET_SECURITY_CONFIG, normalizeTicketSecurityConfig } from '@/lib/tickets/securityConfig';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { DEFAULT_WAITLIST_CONFIG, getWaitlistConfigFromAdminLogs } from '@/lib/rsvp/waitlistConfig';

function err(code: string, status: number, payload?: Record<string, any>) {
  return NextResponse.json({ ok: false, error: code, error_code: code, ...(payload || {}) }, { status });
}

async function getOptionalUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) return null;
  const supabase = getServerSupabase();
  const res = await supabase.auth.getUser(token);
  return res.data?.user || null;
}

export async function POST(req: Request) {
  const supabase = getServerSupabase();
  const ua = req.headers.get('user-agent') || '';

  try {
    const g = await guardPublicJsonPost(req, {
      keyPrefix: 'rsvp',
      windowMs: 60_000,
      max: 10,
      honeypotResponse: { ok: true, status: 'reserved', qrToken: null, expiresAt: null },
      tooManyMessage: 'RSVP_RATE_LIMIT',
      tooManyPayload: { ok: false, error_code: 'RSVP_RATE_LIMIT' },
      forbiddenMessage: 'RSVP_FORBIDDEN',
      forbiddenPayload: { ok: false, error_code: 'RSVP_FORBIDDEN' },
    });
    if (!g.ok) return g.response;
    const body = g.body;
    const ip = g.ip === 'unknown' ? null : g.ip;
    const { eventId, name, email, attendees, attendeesCount, payment_method, promoCode, subscribeNewsletter, lang } = body || {};

    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const method = String(payment_method || 'hotove');
    const promo = promoCode ? normalizePromoCode(String(promoCode)) : '';
    const userLang = lang === 'en' ? 'en' : 'cs';

    if (cleanName.length > 100 || cleanEmail.length > 150) {
      return err('RSVP_PAYLOAD_TOO_LARGE', 400);
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!eventId || !cleanName || !emailOk) return err('RSVP_BAD_INPUT', 400);
    if (promo && promo.length > 60) return err('PROMO_TOO_LONG', 400);

    const provided = Array.isArray(attendees) ? attendees.map((a: any) => String(a?.name || '').trim()).filter(Boolean) : [];
    const desiredCountRaw = attendeesCount != null ? Number(attendeesCount) : provided.length || 1;
    const desiredCount = Number.isFinite(desiredCountRaw) ? Math.max(1, Math.min(3, Math.floor(desiredCountRaw))) : 1;
    const attendeeNames = Array.from({ length: desiredCount }).map((_, idx) => ({
      name: (provided[idx] || (idx === 0 ? cleanName : '')).slice(0, 120),
    }));

    const user = await getOptionalUser(req);

    const cfgRes = await supabase
      .from('admin_logs')
      .select('details')
      .eq('action', 'TICKET_SECURITY_CONFIG')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cfgRes.error) throw cfgRes.error;
    const cfg = cfgRes.data?.details?.config
      ? normalizeTicketSecurityConfig(cfgRes.data.details.config)
      : DEFAULT_TICKET_SECURITY_CONFIG;

    const bl = await supabase
      .from('admin_logs')
      .select('details')
      .eq('action', 'TICKET_EMAIL_BLACKLIST')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const entries = Array.isArray(bl.data?.details?.entries) ? bl.data?.details?.entries : [];
    if (isEmailBlacklisted(cleanEmail, entries)) {
      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: cleanEmail,
            admin_name: 'RSVP',
            action: 'RSVP_BLOCKED',
            target_id: String(eventId),
            details: { reason: 'blacklist', email: cleanEmail, ip, ua: ua.slice(0, 240), createdAt: new Date().toISOString() },
          },
        ]);
      } catch {}
      return err('RSVP_BLACKLISTED', 403);
    }

    const loadEvent = async (withTicketSaleEnd: boolean) => {
      const select = withTicketSaleEnd
        ? 'id, title, capacity, ticket_sale_end, is_member_only'
        : 'id, title, capacity, is_member_only';
      return supabase.from('events').select(select).eq('id', eventId).single();
    };
    const first: any = await loadEvent(true);
    let event: any = first.data;
    let evErr: any = first.error;
    if (
      evErr &&
      /ticket_sale_end/i.test(evErr.message) &&
      /(schema cache|does not exist|column)/i.test(evErr.message)
    ) {
      const retry: any = await loadEvent(false);
      event = retry.data;
      evErr = retry.error;
    }
    if (evErr || !event) return err('RSVP_EVENT_NOT_FOUND', 404);

    const now = new Date();
    if (event.ticket_sale_end && new Date(event.ticket_sale_end) < now) {
      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: cleanEmail,
            admin_name: 'RSVP',
            action: 'RSVP_REJECT',
            target_id: String(eventId),
            details: { reason: 'closed', email: cleanEmail, ip, ua: ua.slice(0, 240), createdAt: new Date().toISOString() },
          },
        ]);
      } catch {}
      return err('RSVP_CLOSED', 400);
    }

    if (event.is_member_only) {
      if (!user) {
        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: cleanEmail,
              admin_name: 'RSVP',
              action: 'RSVP_REJECT',
              target_id: String(eventId),
              details: { reason: 'members_only_unauthorized', email: cleanEmail, ip, ua: ua.slice(0, 240), createdAt: new Date().toISOString() },
            },
          ]);
        } catch {}
        return err('RSVP_MEMBERS_ONLY', 401);
      }
      const { data: prof, error: profErr } = await supabase.from('profiles').select('is_member, email').eq('id', user.id).maybeSingle();
      if (profErr) throw profErr;
      if (!prof?.is_member) {
        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: cleanEmail,
              admin_name: 'RSVP',
              action: 'RSVP_REJECT',
              target_id: String(eventId),
              details: { reason: 'members_only', email: cleanEmail, ip, userId: user.id, createdAt: new Date().toISOString() },
            },
          ]);
        } catch {}
        return err('RSVP_MEMBERS_ONLY', 403);
      }
      if (user.email && user.email.toLowerCase() !== cleanEmail) {
        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: cleanEmail,
              admin_name: 'RSVP',
              action: 'RSVP_REJECT',
              target_id: String(eventId),
              details: { reason: 'member_email_mismatch', email: cleanEmail, ip, userId: user.id, createdAt: new Date().toISOString() },
            },
          ]);
        } catch {}
        return err('RSVP_MEMBER_EMAIL_MISMATCH', 400);
      }
    }

    let promoTitle = '';
    if (promo) {
      const pr = await supabase
        .from('admin_logs')
        .select('details')
        .eq('action', 'PROMO_RULES')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pr.error) throw pr.error;
      const rules = Array.isArray(pr.data?.details?.rules) ? pr.data!.details.rules : [];
      const rule =
        rules.find((r: any) => normalizePromoCode(String(r?.code || '')) === promo) || null;

      const nowMs = Date.now();
      const mode = rule?.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp';
      const consumed = mode === 'per_attendee' ? attendeeNames.length : 1;
      const reject = async (reason: string) => {
        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: cleanEmail,
              admin_name: 'Promo',
              action: 'PROMO_REJECT',
              target_id: promo,
              details: {
                code: promo,
                reason,
                eventId: String(eventId),
                email: cleanEmail,
                ip,
                userId: user?.id || null,
                consumed,
                mode,
                createdAt: new Date().toISOString(),
              },
            },
          ]);
        } catch {}
        return err(reason, 400);
      };

      if (!rule) return await reject('PROMO_INVALID');
      if (!rule.active) return await reject('PROMO_INACTIVE');
      if (rule.startsAt && Number.isFinite(new Date(rule.startsAt).getTime()) && nowMs < new Date(rule.startsAt).getTime()) {
        return await reject('PROMO_NOT_STARTED');
      }
      if (rule.endsAt && Number.isFinite(new Date(rule.endsAt).getTime()) && nowMs > new Date(rule.endsAt).getTime()) {
        return await reject('PROMO_ENDED');
      }
      if (Array.isArray(rule.eventIds) && rule.eventIds.length > 0 && !rule.eventIds.map(String).includes(String(eventId))) {
        return await reject('PROMO_NOT_FOR_EVENT');
      }
      if (Array.isArray(rule.whitelistEmails) && rule.whitelistEmails.length > 0) {
        const wl = rule.whitelistEmails.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
        if (wl.length > 0 && !wl.includes(cleanEmail)) return await reject('PROMO_NOT_ALLOWED_EMAIL');
      }

      const maxUses = rule.maxUses == null || rule.maxUses === '' ? null : Number(rule.maxUses);
      if (Number.isFinite(maxUses) && maxUses! >= 1) {
        const usedRes = await supabase
          .from('admin_logs')
          .select('details, created_at')
          .eq('action', 'PROMO_USE')
          .eq('target_id', promo)
          .order('created_at', { ascending: false })
          .limit(5000);
        if (usedRes.error) throw usedRes.error;
        const used = (usedRes.data || []).reduce((acc: number, row: any) => {
          const n = Number(row?.details?.consumed ?? 1);
          return acc + (Number.isFinite(n) && n > 0 ? n : 1);
        }, 0);
        if (used + consumed > Math.floor(maxUses!)) return await reject('PROMO_EXHAUSTED');
      }

      const perEmail = rule.maxUsesPerEmail == null || rule.maxUsesPerEmail === '' ? null : Number(rule.maxUsesPerEmail);
      if (Number.isFinite(perEmail) && perEmail! >= 1) {
        const usedEmailRes = await supabase
          .from('admin_logs')
          .select('details, created_at')
          .eq('action', 'PROMO_USE')
          .eq('target_id', promo)
          .eq('details->>email', cleanEmail)
          .order('created_at', { ascending: false })
          .limit(5000);
        if (usedEmailRes.error) throw usedEmailRes.error;
        const used = (usedEmailRes.data || []).reduce((acc: number, row: any) => {
          const n = Number(row?.details?.consumed ?? 1);
          return acc + (Number.isFinite(n) && n > 0 ? n : 1);
        }, 0);
        if (used + consumed > Math.floor(perEmail!)) return await reject('PROMO_LIMIT_EMAIL');
      }

      promoTitle = rule.title ? String(rule.title).trim() : '';
    }

    const sinceWindow = new Date(Date.now() - cfg.rsvp.windowMinutes * 60 * 1000).toISOString();
    if (ip) {
      const ipRes = await supabase
        .from('admin_logs')
        .select('id')
        .eq('action', 'RSVP_ATTEMPT')
        .eq('target_id', String(eventId))
        .eq('details->>ip', ip)
        .gte('created_at', sinceWindow)
        .limit(50);
      if (ipRes.error) throw ipRes.error;
      if ((ipRes.data || []).length >= cfg.rsvp.maxAttemptsPerIp) {
        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: cleanEmail,
              admin_name: 'RSVP',
              action: 'RSVP_RATE_LIMIT',
              target_id: String(eventId),
              details: { scope: 'ip', ip, email: cleanEmail, limit: cfg.rsvp.maxAttemptsPerIp, windowMinutes: cfg.rsvp.windowMinutes, createdAt: new Date().toISOString() },
            },
          ]);
        } catch {}
        return err('RSVP_RATE_LIMIT', 429);
      }

      const emailRes = await supabase
        .from('admin_logs')
        .select('id')
        .eq('action', 'RSVP_ATTEMPT')
        .eq('details->>email', cleanEmail)
        .gte('created_at', sinceWindow)
        .limit(50);
      if (emailRes.error) throw emailRes.error;
      if ((emailRes.data || []).length >= cfg.rsvp.maxAttemptsPerEmail) {
        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: cleanEmail,
              admin_name: 'RSVP',
              action: 'RSVP_RATE_LIMIT',
              target_id: String(eventId),
              details: { scope: 'email', ip, email: cleanEmail, limit: cfg.rsvp.maxAttemptsPerEmail, windowMinutes: cfg.rsvp.windowMinutes, createdAt: new Date().toISOString() },
            },
          ]);
        } catch {}
        return err('RSVP_RATE_LIMIT', 429);
      }
    }

    try {
      await supabase.from('admin_logs').insert([
        {
          admin_email: cleanEmail,
          admin_name: 'RSVP',
          action: 'RSVP_ATTEMPT',
          target_id: String(eventId),
          details: {
            eventId: String(eventId),
            email: cleanEmail,
            ip,
            ua: ua.slice(0, 240),
            attendeesCount: attendeeNames.length,
            paymentMethod: method,
            promoCode: promo || null,
            userId: user?.id || null,
            createdAt: new Date().toISOString(),
          },
        },
      ]);
    } catch {}

    const existingRes = await supabase
      .from('rsvp')
      .select('id, status, expires_at')
      .eq('event_id', eventId)
      .eq('email', cleanEmail)
      .order('created_at', { ascending: false })
      .limit(5);
    if (existingRes.error) throw existingRes.error;

    const hasActiveExisting =
      (existingRes.data || []).some((r: any) => {
        if (r.status === 'cancelled') return false;
        if (!r.expires_at) return true;
        return new Date(r.expires_at) > now;
      }) || false;
    if (hasActiveExisting) {
      try {
        await supabase.from('admin_logs').insert([
          {
            admin_email: cleanEmail,
            admin_name: 'RSVP',
            action: 'RSVP_DUPLICATE',
            target_id: String(eventId),
            details: { email: cleanEmail, ip, userId: user?.id || null, createdAt: new Date().toISOString() },
          },
        ]);
      } catch {}
      return err('RSVP_ALREADY_REGISTERED', 409);
    }

    const capacity = typeof event.capacity === 'number' ? event.capacity : null;
    let taken = 0;
    if (capacity) {
      const activeRes = await supabase.from('rsvp').select('status, expires_at, attendees').eq('event_id', eventId).in('status', ['confirmed', 'reserved']);
      if (activeRes.error) throw activeRes.error;
      taken = (activeRes.data || []).reduce((acc: number, r: any) => {
        if (r.status === 'cancelled') return acc;
        if (r.expires_at && new Date(r.expires_at) <= now) return acc;
        const n = Array.isArray(r.attendees) ? r.attendees.length : 1;
        return acc + n;
      }, 0);
    }

    let status = 'confirmed';
    if (capacity && taken + attendeeNames.length > capacity) {
      status = 'waitlist';
    } else {
      status = method === 'prevod' ? 'reserved' : 'confirmed';
    }

    const qrToken = Math.random().toString(36).substring(2, 15).toUpperCase();
    let reservationExpiresHours = 24;
    try {
      const { config } = await getWaitlistConfigFromAdminLogs(supabase);
      reservationExpiresHours = Number(config?.reservationExpiresHours || DEFAULT_WAITLIST_CONFIG.reservationExpiresHours);
    } catch {}
    const expiresAt =
      status === 'reserved' ? new Date(now.getTime() + reservationExpiresHours * 60 * 60 * 1000).toISOString() : null;

    const baseRow: any = {
      event_id: eventId,
      name: cleanName,
      email: cleanEmail,
      status,
      payment_method: method,
      attendees: attendeeNames,
      qr_token: qrToken,
      qr_code: qrToken,
      expires_at: expiresAt,
    };

    const tryInsert = async (row: any) => supabase.from('rsvp').insert([row]).select('id').single();
    let ins: any = await tryInsert(baseRow);
    if (
      ins?.error &&
      /(qr_code|qr_token)/i.test(ins.error.message) &&
      /(schema cache|does not exist|column)/i.test(ins.error.message)
    ) {
      const row2: any = { ...baseRow };
      if (/qr_code/i.test(ins.error.message)) delete row2.qr_code;
      if (/qr_token/i.test(ins.error.message)) delete row2.qr_token;
      ins = await tryInsert(row2);
    }
    if (ins.error) throw ins.error;
    const rsvpId = String(ins.data?.id || '');

    if (promo) {
      try {
        const pr = await supabase
          .from('admin_logs')
          .select('details')
          .eq('action', 'PROMO_RULES')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const rules = Array.isArray(pr.data?.details?.rules) ? pr.data!.details.rules : [];
        const rule = rules.find((r: any) => normalizePromoCode(String(r?.code || '')) === promo) || null;
        const mode = rule?.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp';
        const consumed = mode === 'per_attendee' ? attendeeNames.length : 1;
        await supabase.from('admin_logs').insert([
          {
            admin_email: cleanEmail,
            admin_name: 'Promo',
            action: 'PROMO_USE',
            target_id: promo,
            details: {
              code: promo,
              title: promoTitle || null,
              mode,
              consumed,
              eventId: String(eventId),
              eventTitle: event.title,
              rsvpId: rsvpId || null,
              email: cleanEmail,
              attendeesCount: attendeeNames.length,
              status,
              ip,
              userId: user?.id || null,
              createdAt: new Date().toISOString(),
            },
          },
        ]);
      } catch {}
    }

    try {
      let bankAccount = process.env.BANK_ACCOUNT || 'CZ1234567890';
      try {
        const { data } = await supabase.from('payment_settings').select('bank_account').single();
        if (data?.bank_account) bankAccount = String(data.bank_account);
      } catch {}

      const transporter = await getMailerWithSettingsOrQueueTransporter();
      const from = await getSenderFromSettings();
      const { subject, html } = await renderEmailTemplateWithDbOverride('ticket', {
        email: cleanEmail,
        name: cleanName,
        eventTitle: event.title,
        attendees: attendeeNames,
        paymentMethod: method,
        qrToken,
        status,
        bankAccount,
        lang: userLang,
      });
      await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'ticket', eventId: String(eventId), rsvpId, status, email: cleanEmail },
        message: { from, to: cleanEmail, subject, html, text: stripHtmlToText(html) },
      });
    } catch {}

    if (subscribeNewsletter) {
      try {
        await fetch(new URL('/api/newsletter/subscribe', req.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, categories: ['all'], source: 'rsvp' }),
        });
      } catch {}
    }

    return NextResponse.json({ ok: true, status, qrToken, expiresAt, eventId: String(eventId) });
  } catch (e: any) {
    return err('RSVP_ERROR', 500, { message: e?.message || 'Error' });
  }
}
