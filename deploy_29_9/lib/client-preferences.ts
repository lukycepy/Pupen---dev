'use client';

export type CookieConsentValue = 'accepted' | 'declined';

export type RsvpAttendeeDraft = {
  name: string;
  birth_date?: string | null;
};

export type RsvpSharedDraft = {
  name: string;
  email: string;
  payment_method: 'hotove' | 'prevod';
  subscribe_newsletter: boolean;
  attendeesCount: number;
  attendees: RsvpAttendeeDraft[];
};

export const COOKIE_CONSENT_STORAGE_KEY = 'cookie-consent';
export const COOKIE_CONSENT_COOKIE_KEY = 'pupen_cookie_consent';
export const RSVP_SHARED_DRAFT_COOKIE_KEY = 'pupen_rsvp_shared_draft';

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;
const RSVP_DRAFT_MAX_AGE = 60 * 60 * 24 * 30;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function readCookie(name: string): string | null {
  if (!isBrowser()) return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split('; ')
    .find((chunk) => chunk.startsWith(prefix));

  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(prefix.length));
}

export function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (!isBrowser()) return;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${Math.max(
    1,
    Math.floor(maxAgeSeconds),
  )}; samesite=lax`;
}

export function readCookieConsent(): CookieConsentValue | null {
  if (!isBrowser()) return null;

  try {
    const stored = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (stored === 'accepted' || stored === 'declined') {
      writeCookie(COOKIE_CONSENT_COOKIE_KEY, stored, YEAR_IN_SECONDS);
      return stored;
    }
  } catch {}

  const fromCookie = readCookie(COOKIE_CONSENT_COOKIE_KEY);
  if (fromCookie === 'accepted' || fromCookie === 'declined') {
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, fromCookie);
    } catch {}
    return fromCookie;
  }

  return null;
}

export function writeCookieConsent(value: CookieConsentValue) {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
  } catch {}

  writeCookie(COOKIE_CONSENT_COOKIE_KEY, value, YEAR_IN_SECONDS);
  window.dispatchEvent(new Event('cookie-consent-changed'));
}

function normalizeAttendees(value: unknown): RsvpAttendeeDraft[] {
  if (!Array.isArray(value)) return [{ name: '' }];

  const attendees = value
    .slice(0, 3)
    .map((item) => {
      if (typeof item === 'object' && item !== null && 'name' in item) {
        const row = item as { name?: unknown; birth_date?: unknown };
        const birthDate = typeof row.birth_date === 'string' && row.birth_date.trim() ? row.birth_date.trim().slice(0, 10) : null;
        return { name: String(row.name || '').slice(0, 120), birth_date: birthDate };
      }
      return { name: '', birth_date: null };
    })
    .filter((item, index) => index === 0 || item.name.trim());

  return attendees.length > 0 ? attendees : [{ name: '', birth_date: null }];
}

export function normalizeRsvpSharedDraft(value: unknown): RsvpSharedDraft {
  const record = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const attendees = normalizeAttendees(record.attendees);
  const attendeesCountRaw = Number(record.attendeesCount);
  const attendeesCount = Number.isFinite(attendeesCountRaw)
    ? Math.max(1, Math.min(3, Math.floor(attendeesCountRaw)))
    : Math.max(1, Math.min(3, attendees.length));

  return {
    name: String(record.name || '').slice(0, 120),
    email: String(record.email || '').slice(0, 160),
    payment_method: record.payment_method === 'prevod' ? 'prevod' : 'hotove',
    subscribe_newsletter: record.subscribe_newsletter === true,
    attendeesCount,
    attendees: Array.from({ length: attendeesCount }).map((_, index) => attendees[index] || { name: '', birth_date: null }),
  };
}

export function readRsvpSharedDraft(): RsvpSharedDraft | null {
  if (!isBrowser()) return null;
  const raw = readCookie(RSVP_SHARED_DRAFT_COOKIE_KEY);
  if (!raw) return null;

  try {
    return normalizeRsvpSharedDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeRsvpSharedDraft(value: unknown) {
  if (!isBrowser()) return;
  const normalized = normalizeRsvpSharedDraft(value);
  writeCookie(RSVP_SHARED_DRAFT_COOKIE_KEY, JSON.stringify(normalized), RSVP_DRAFT_MAX_AGE);
}
