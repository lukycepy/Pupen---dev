import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
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
import { createEventOrder, getPaymentBankAccount, mapRsvpStatusToOrderStatus } from '@/lib/rsvp/orders';
import { buildEventCalendarAttachment } from '@/lib/tickets/calendarInvite';
import { buildTicketPdfAttachment, buildTicketPdfUrl } from '@/lib/tickets/pdf';
import { ensureGuardianConsentPdf, getMinorAttendees } from '@/lib/rsvp/guardianConsent';

interface EventRow {
  id?: string | null;
  title?: string | null;
  title_en?: string | null;
  capacity?: number | null;
  ticket_sale_end?: string | null;
  is_member_only?: boolean | null;
  min_age?: number | null;
  max_age?: number | null;
  date?: string | null;
}

interface RsvpExistingRow {
  status?: string | null;
  expires_at?: string | null;
  attendees?: Array<{ name?: string; birth_date?: string | null }> | null;
}

interface AttendeeRow {
  name: string;
  birth_date?: string | null;
}

interface PriceRuleRow {
  id?: string | null;
  sort_order?: number | null;
  label?: string | null;
  label_en?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  amount_czk?: number | string | null;
  is_active?: boolean | null;
}

interface RegistrationFieldOption {
  value: string;
  label: string;
  label_en?: string | null;
}

interface RegistrationFieldRow {
  id?: string | null;
  field_key?: string | null;
  field_type?: string | null;
  label?: string | null;
  label_en?: string | null;
  placeholder?: string | null;
  placeholder_en?: string | null;
  helper_text?: string | null;
  helper_text_en?: string | null;
  options?: RegistrationFieldOption[] | null;
  is_required?: boolean | null;
  is_active?: boolean | null;
  sort_order?: number | null;
}

interface RsvpInsertRow {
  event_id: string;
  name: string;
  email: string;
  status: string;
  promo_code?: string;
  payment_method: string;
  attendees: AttendeeRow[];
  form_answers?: Record<string, string | boolean | null>;
  price_total?: number;
  currency?: string;
  pricing_label?: string | null;
  pricing_label_en?: string | null;
  pricing_rule_id?: string | null;
  event_order_id?: string | null;
  variable_symbol?: string | null;
  payment_due_at?: string | null;
  paid_at?: string | null;
  has_minor_attendee?: boolean;
  guardian_consent_required?: boolean;
  guardian_consent_status?: string;
  qr_token?: string;
  qr_code?: string;
  expires_at: string | null;
}

function asTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function generateQrToken() {
  return randomBytes(16).toString('hex').toUpperCase();
}

function hasMissingColumnError(message: string, field: string) {
  return new RegExp(field, 'i').test(message) && /(schema cache|does not exist|column)/i.test(message);
}

function asOptionalDateString(value: unknown) {
  const input = asTrimmedString(value);
  if (!input) return null;
  const parsed = new Date(input);
  if (!Number.isFinite(parsed.getTime())) return null;
  return input.length >= 10 ? input.slice(0, 10) : null;
}

function calculateAgeAtDate(birthDate: string, targetDate: string | null | undefined) {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  const target = targetDate ? new Date(targetDate) : new Date();
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(target.getTime())) return null;
  let age = target.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = target.getUTCMonth() - birth.getUTCMonth();
  const dayDelta = target.getUTCDate() - birth.getUTCDate();
  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) age -= 1;
  return age;
}

function toMoney(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function normalizeFieldValue(field: RegistrationFieldRow, rawValue: unknown) {
  const type = String(field.field_type || 'text');

  if (type === 'checkbox') {
    return rawValue === true;
  }

  if (type === 'date') {
    return asOptionalDateString(rawValue);
  }

  const text = asTrimmedString(rawValue).slice(0, 500);
  if (!text) return null;

  if (type === 'select') {
    const options = Array.isArray(field.options) ? field.options : [];
    const allowed = new Set(options.map((option) => asTrimmedString(option?.value)).filter(Boolean));
    return allowed.has(text) ? text : null;
  }

  return text;
}

async function loadEventPriceRules(supabase: ReturnType<typeof getServerSupabase>, eventId: string) {
  const res = await supabase
    .from('event_price_rules')
    .select('id, sort_order, label, label_en, starts_at, ends_at, amount_czk, is_active')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('starts_at', { ascending: true });

  if (res.error) {
    if (/event_price_rules/i.test(res.error.message) && /(schema cache|does not exist|relation)/i.test(res.error.message)) {
      return [];
    }
    throw res.error;
  }

  return (res.data || []) as PriceRuleRow[];
}

async function loadRegistrationFields(supabase: ReturnType<typeof getServerSupabase>, eventId: string) {
  const res = await supabase
    .from('event_registration_fields')
    .select('id, field_key, field_type, label, label_en, placeholder, placeholder_en, helper_text, helper_text_en, options, is_required, is_active, sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (res.error) {
    if (/event_registration_fields/i.test(res.error.message) && /(schema cache|does not exist|relation)/i.test(res.error.message)) {
      return [];
    }
    throw res.error;
  }

  return (res.data || []) as RegistrationFieldRow[];
}

function toRecord(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function err(code: string, status: number, payload?: Record<string, unknown>) {
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
    const eventId = asTrimmedString(body.eventId);
    const cleanName = asTrimmedString(body.name);
    const cleanEmail = asTrimmedString(body.email).toLowerCase();
    const method = asTrimmedString(body.payment_method) || 'hotove';
    const promoCode = asTrimmedString(body.promoCode);
    const promo = promoCode ? normalizePromoCode(promoCode) : '';
    const userLang = body.lang === 'en' ? 'en' : 'cs';
    const subscribeNewsletter = body.subscribeNewsletter;
    const attendees = Array.isArray(body.attendees) ? body.attendees : [];
    const attendeesCount = body.attendeesCount;
    const formAnswersInput = toRecord(body.formAnswers);

    if (cleanName.length > 100 || cleanEmail.length > 150) {
      return err('RSVP_PAYLOAD_TOO_LARGE', 400);
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!eventId || !cleanName || !emailOk) return err('RSVP_BAD_INPUT', 400);
    if (promo && promo.length > 60) return err('PROMO_TOO_LONG', 400);

    const provided = attendees.map((attendee) => {
      const row = toRecord(attendee);
      return {
        name: asTrimmedString(row.name),
        birth_date: asOptionalDateString(row.birth_date),
      };
    });
    const providedNames = provided.map((attendee) => attendee.name).filter(Boolean);
    const desiredCountRaw = attendeesCount != null ? Number(attendeesCount) : providedNames.length || 1;
    const desiredCount = Number.isFinite(desiredCountRaw) ? Math.max(1, Math.min(3, Math.floor(desiredCountRaw))) : 1;
    const attendeeNames = Array.from({ length: desiredCount }).map((_, idx) => ({
      name: (provided[idx]?.name || (idx === 0 ? cleanName : '')).slice(0, 120),
      birth_date: provided[idx]?.birth_date || null,
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
        ? 'id, title, title_en, date, capacity, ticket_sale_end, is_member_only, min_age, max_age'
        : 'id, title, title_en, date, capacity, is_member_only';
      return supabase.from('events').select(select).eq('id', eventId).single();
    };
    const first = await loadEvent(true);
    let event = first.data as EventRow | null;
    let evErr = first.error;
    if (
      evErr &&
      hasMissingColumnError(evErr.message, 'ticket_sale_end')
    ) {
      const retry = await loadEvent(false);
      event = retry.data as EventRow | null;
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

    const minors = getMinorAttendees(attendeeNames, event.date);

    if (event.min_age != null || event.max_age != null) {
      const invalidBirthDateIndex = attendeeNames.findIndex((attendee) => !attendee.birth_date);
      if (invalidBirthDateIndex >= 0) {
        return err('RSVP_BIRTH_DATE_REQUIRED', 400, { attendeeIndex: invalidBirthDateIndex });
      }

      for (let index = 0; index < attendeeNames.length; index += 1) {
        const attendee = attendeeNames[index];
        const age = attendee.birth_date ? calculateAgeAtDate(attendee.birth_date, event.date) : null;
        if (age == null) return err('RSVP_BIRTH_DATE_REQUIRED', 400, { attendeeIndex: index });
        if (typeof event.min_age === 'number' && age < event.min_age) {
          return err('RSVP_AGE_RESTRICTION', 400, {
            attendeeIndex: index,
            minAge: event.min_age,
            maxAge: event.max_age ?? null,
            age,
          });
        }
        if (typeof event.max_age === 'number' && age > event.max_age) {
          return err('RSVP_AGE_RESTRICTION', 400, {
            attendeeIndex: index,
            minAge: event.min_age ?? null,
            maxAge: event.max_age,
            age,
          });
        }
      }
    }

    const registrationFields = (await loadRegistrationFields(supabase, eventId)).filter((field) => field.is_active !== false);
    const normalizedFormAnswers = registrationFields.reduce<Record<string, string | boolean | null>>((acc, field) => {
      const fieldKey = asTrimmedString(field.field_key);
      if (!fieldKey) return acc;
      const value = normalizeFieldValue(field, formAnswersInput[fieldKey]);
      if (field.is_required && (value == null || value === '')) {
        throw new Error(`RSVP_FIELD_REQUIRED:${fieldKey}`);
      }
      if (String(field.field_type || 'text') === 'select' && formAnswersInput[fieldKey] != null && value == null) {
        throw new Error(`RSVP_FIELD_INVALID:${fieldKey}`);
      }
      acc[fieldKey] = value;
      return acc;
    }, {});

    let promoTitle = '';
    let promoMode: 'per_rsvp' | 'per_attendee' = 'per_rsvp';
    let promoDiscountAmount = 0;
    let promoDiscountPercentage = 0;
    if (promo) {
      const pr = await supabase
        .from('admin_logs')
        .select('details')
        .eq('action', 'PROMO_RULES')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pr.error) throw pr.error;
      const rules: unknown[] = Array.isArray(pr.data?.details?.rules) ? pr.data!.details.rules : [];
      const rule =
        rules.find((ruleValue: unknown) => normalizePromoCode(String(toRecord(ruleValue).code || '')) === promo) || null;
      const ruleRecord = toRecord(rule);

      const nowMs = Date.now();
      const mode = ruleRecord.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp';
      promoMode = mode;
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
      if (!ruleRecord.active) return await reject('PROMO_INACTIVE');
      if (ruleRecord.startsAt && Number.isFinite(new Date(String(ruleRecord.startsAt)).getTime()) && nowMs < new Date(String(ruleRecord.startsAt)).getTime()) {
        return await reject('PROMO_NOT_STARTED');
      }
      if (ruleRecord.endsAt && Number.isFinite(new Date(String(ruleRecord.endsAt)).getTime()) && nowMs > new Date(String(ruleRecord.endsAt)).getTime()) {
        return await reject('PROMO_ENDED');
      }
      if (Array.isArray(ruleRecord.eventIds) && ruleRecord.eventIds.length > 0 && !ruleRecord.eventIds.map(String).includes(String(eventId))) {
        return await reject('PROMO_NOT_FOR_EVENT');
      }
      if (Array.isArray(ruleRecord.whitelistEmails) && ruleRecord.whitelistEmails.length > 0) {
        const wl = ruleRecord.whitelistEmails.map((x: unknown) => String(x).trim().toLowerCase()).filter(Boolean);
        if (wl.length > 0 && !wl.includes(cleanEmail)) return await reject('PROMO_NOT_ALLOWED_EMAIL');
      }

      const maxUses = ruleRecord.maxUses == null || ruleRecord.maxUses === '' ? null : Number(ruleRecord.maxUses);
      if (Number.isFinite(maxUses) && maxUses! >= 1) {
        const usedRes = await supabase
          .from('admin_logs')
          .select('details, created_at')
          .eq('action', 'PROMO_USE')
          .eq('target_id', promo)
          .order('created_at', { ascending: false })
          .limit(5000);
        if (usedRes.error) throw usedRes.error;
        const used = (usedRes.data || []).reduce((acc: number, row) => {
          const details = toRecord(row.details);
          const n = Number(details.consumed ?? 1);
          return acc + (Number.isFinite(n) && n > 0 ? n : 1);
        }, 0);
        if (used + consumed > Math.floor(maxUses!)) return await reject('PROMO_EXHAUSTED');
      }

      const perEmail = ruleRecord.maxUsesPerEmail == null || ruleRecord.maxUsesPerEmail === '' ? null : Number(ruleRecord.maxUsesPerEmail);
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
        const used = (usedEmailRes.data || []).reduce((acc: number, row) => {
          const details = toRecord(row.details);
          const n = Number(details.consumed ?? 1);
          return acc + (Number.isFinite(n) && n > 0 ? n : 1);
        }, 0);
        if (used + consumed > Math.floor(perEmail!)) return await reject('PROMO_LIMIT_EMAIL');
      }

      promoTitle = ruleRecord.title ? String(ruleRecord.title).trim() : '';
      promoDiscountAmount = Number(ruleRecord.discountAmount);
      promoDiscountPercentage = Number(ruleRecord.discountPercentage);
    }

    const activePriceRules = (await loadEventPriceRules(supabase, eventId)).filter((rule) => {
      if (rule.is_active === false) return false;
      const startsAt = rule.starts_at ? new Date(rule.starts_at).getTime() : null;
      const endsAt = rule.ends_at ? new Date(rule.ends_at).getTime() : null;
      const nowMs = now.getTime();
      if (startsAt != null && Number.isFinite(startsAt) && nowMs < startsAt) return false;
      if (endsAt != null && Number.isFinite(endsAt) && nowMs > endsAt) return false;
      return true;
    });

    const activePriceRule =
      activePriceRules
        .slice()
        .sort((left, right) => {
          const leftOrder = Number(left.sort_order ?? 0);
          const rightOrder = Number(right.sort_order ?? 0);
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return String(left.starts_at || '').localeCompare(String(right.starts_at || ''));
        })[0] || null;

    const unitPrice = activePriceRule ? Number(activePriceRule.amount_czk || 0) : 0;
    const subtotal = toMoney((Number.isFinite(unitPrice) ? unitPrice : 0) * attendeeNames.length);
    const fixedDiscountUnits = promo ? (promoMode === 'per_attendee' ? attendeeNames.length : 1) : 0;
    const fixedDiscount = Number.isFinite(promoDiscountAmount) && promoDiscountAmount > 0 ? promoDiscountAmount * fixedDiscountUnits : 0;
    const percentageDiscount =
      Number.isFinite(promoDiscountPercentage) && promoDiscountPercentage > 0
        ? subtotal * (promoDiscountPercentage / 100)
        : 0;
    const totalDiscount = toMoney(Math.min(subtotal, fixedDiscount + percentageDiscount));
    const totalPrice = toMoney(subtotal - totalDiscount);

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
      (existingRes.data || []).some((r: RsvpExistingRow) => {
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
      taken = (activeRes.data || []).reduce((acc: number, r: RsvpExistingRow) => {
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

    const qrToken = generateQrToken();
    let reservationExpiresHours = 24;
    try {
      const { config } = await getWaitlistConfigFromAdminLogs(supabase);
      reservationExpiresHours = Number(config?.reservationExpiresHours || DEFAULT_WAITLIST_CONFIG.reservationExpiresHours);
    } catch {}
    const expiresAt =
      status === 'reserved' ? new Date(now.getTime() + reservationExpiresHours * 60 * 60 * 1000).toISOString() : null;

    const eventOrder = await createEventOrder(supabase, {
      eventId,
      buyerName: cleanName,
      buyerEmail: cleanEmail,
      paymentMethod: method,
      status: mapRsvpStatusToOrderStatus(status),
      totalAmount: totalPrice,
      currency: 'CZK',
      reservationExpiresAt: expiresAt,
      meta: {
        promoCode: promo || null,
        pricingRuleId: activePriceRule?.id || null,
        attendeesCount: attendeeNames.length,
        lang: userLang,
      },
    });

    const baseRow: RsvpInsertRow = {
      event_id: eventId,
      name: cleanName,
      email: cleanEmail,
      status,
      promo_code: promo || undefined,
      payment_method: method,
      attendees: attendeeNames,
      form_answers: normalizedFormAnswers,
      price_total: totalPrice,
      currency: 'CZK',
      pricing_label: activePriceRule?.label ? String(activePriceRule.label) : null,
      pricing_label_en: activePriceRule?.label_en ? String(activePriceRule.label_en) : null,
      pricing_rule_id: activePriceRule?.id ? String(activePriceRule.id) : null,
      event_order_id: eventOrder.id,
      variable_symbol: eventOrder.variableSymbol,
      payment_due_at: expiresAt,
      paid_at: status === 'confirmed' ? now.toISOString() : null,
      has_minor_attendee: minors.length > 0,
      guardian_consent_required: minors.length > 0,
      guardian_consent_status: minors.length > 0 ? 'required' : 'not_required',
      qr_token: qrToken,
      qr_code: qrToken,
      expires_at: expiresAt,
    };

    const tryInsert = async (row: RsvpInsertRow) => supabase.from('rsvp').insert([row]).select('id').single();
    let ins = await tryInsert(baseRow);
    if (
      ins?.error &&
      /(qr_code|qr_token|form_answers|price_total|pricing_label|pricing_rule_id|currency|event_order_id|variable_symbol|payment_due_at|paid_at|has_minor_attendee|guardian_consent_required|guardian_consent_status)/i.test(ins.error.message) &&
      /(schema cache|does not exist|column)/i.test(ins.error.message)
    ) {
      const row2 = { ...baseRow };
      if (/qr_code/i.test(ins.error.message)) delete row2.qr_code;
      if (/qr_token/i.test(ins.error.message)) delete row2.qr_token;
      if (/form_answers/i.test(ins.error.message)) delete row2.form_answers;
      if (/price_total/i.test(ins.error.message)) delete row2.price_total;
      if (/currency/i.test(ins.error.message)) delete row2.currency;
      if (/pricing_label/i.test(ins.error.message)) delete row2.pricing_label;
      if (/pricing_label_en/i.test(ins.error.message)) delete row2.pricing_label_en;
      if (/pricing_rule_id/i.test(ins.error.message)) delete row2.pricing_rule_id;
      if (/event_order_id/i.test(ins.error.message)) delete row2.event_order_id;
      if (/variable_symbol/i.test(ins.error.message)) delete row2.variable_symbol;
      if (/payment_due_at/i.test(ins.error.message)) delete row2.payment_due_at;
      if (/paid_at/i.test(ins.error.message)) delete row2.paid_at;
      if (/has_minor_attendee/i.test(ins.error.message)) delete row2.has_minor_attendee;
      if (/guardian_consent_required/i.test(ins.error.message)) delete row2.guardian_consent_required;
      if (/guardian_consent_status/i.test(ins.error.message)) delete row2.guardian_consent_status;
      ins = await tryInsert(row2);
    }
    if (ins.error) {
      if (eventOrder.id) {
        try {
          await supabase.from('event_orders').delete().eq('id', eventOrder.id);
        } catch {}
      }
      throw ins.error;
    }
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
        const rules: unknown[] = Array.isArray(pr.data?.details?.rules) ? pr.data!.details.rules : [];
        const rule = rules.find((ruleValue: unknown) => normalizePromoCode(String(toRecord(ruleValue).code || '')) === promo) || null;
        const ruleRecord = toRecord(rule);
        const mode = ruleRecord.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp';
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
              subtotal,
              totalDiscount,
              totalPrice,
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
      const bankAccount = await getPaymentBankAccount(supabase);

      const transporter = await getMailerWithSettingsOrQueueTransporter();
      const from = await getSenderFromSettings();
      const calendarAttachment = await buildEventCalendarAttachment(String(eventId), userLang);
      const ticketPdfAttachment = await buildTicketPdfAttachment({
        event,
        rsvp: {
          id: rsvpId,
          name: cleanName,
          email: cleanEmail,
          attendees: attendeeNames,
          qr_token: qrToken,
          qr_code: qrToken,
          status,
          expires_at: expiresAt,
          payment_method: method,
          variable_symbol: eventOrder.variableSymbol,
          price_total: totalPrice,
          pricing_label: activePriceRule?.label || null,
          pricing_label_en: activePriceRule?.label_en || null,
        },
        lang: userLang,
      });
      const guardianConsent = await ensureGuardianConsentPdf({
        event,
        rsvp: {
          id: rsvpId,
          name: cleanName,
          email: cleanEmail,
          attendees: attendeeNames,
          qr_token: qrToken,
          qr_code: qrToken,
        },
        minors,
        lang: userLang,
      });
      const { subject, html } = await renderEmailTemplateWithDbOverride('ticket', {
        email: cleanEmail,
        name: cleanName,
        eventTitle: event.title,
        attendees: attendeeNames,
        paymentMethod: method,
        qrToken,
        status,
        bankAccount,
        vs: eventOrder.variableSymbol,
        dueDate: expiresAt,
        priceTotal: totalPrice,
        pricingLabel: activePriceRule?.label || '',
        pricingLabelEn: activePriceRule?.label_en || '',
        ticketPdfUrl: buildTicketPdfUrl(qrToken, userLang),
        guardianConsentUrl: guardianConsent.downloadUrl,
        guardianConsentUploadUrl: guardianConsent.uploadUrl,
        lang: userLang,
      });
      await sendMailWithQueueFallback({
        transporter,
        supabase,
        meta: { kind: 'ticket', eventId: String(eventId), rsvpId, status, email: cleanEmail },
        message: {
          from,
          to: cleanEmail,
          subject,
          html,
          text: stripHtmlToText(html),
          attachments: [calendarAttachment, ticketPdfAttachment, guardianConsent.attachment].filter(Boolean) as NonNullable<
            typeof calendarAttachment | typeof ticketPdfAttachment | typeof guardianConsent.attachment
          >[],
        },
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

    return NextResponse.json({
      ok: true,
      status,
      qrToken,
      variableSymbol: eventOrder.variableSymbol,
      expiresAt,
      eventId: String(eventId),
      priceTotal: totalPrice,
      pricingLabel: activePriceRule?.label || null,
      pricingLabelEn: activePriceRule?.label_en || null,
      attendeesCount: attendeeNames.length,
      guardianConsentRequired: minors.length > 0,
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('RSVP_FIELD_REQUIRED:')) {
      return err('RSVP_FIELD_REQUIRED', 400, { fieldKey: error.message.split(':')[1] || null });
    }
    if (error instanceof Error && error.message.startsWith('RSVP_FIELD_INVALID:')) {
      return err('RSVP_FIELD_INVALID', 400, { fieldKey: error.message.split(':')[1] || null });
    }
    return err('RSVP_ERROR', 500, { message: getErrorMessage(error) });
  }
}
