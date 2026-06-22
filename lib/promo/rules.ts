export type PromoRule = {
  code: string;
  title?: string;
  active: boolean;
  mode?: 'per_rsvp' | 'per_attendee';
  discountAmount?: number | null;
  discountPercentage?: number | null;
  maxUses?: number | null;
  maxUsesPerEmail?: number | null;
  eventIds?: string[];
  whitelistEmails?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  note?: string;
};

export function normalizePromoCode(input: string) {
  return String(input || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function parseCsv(input: string) {
  return String(input || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toOptionalNumber(value: unknown) {
  if (value === '' || value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function normalizeEmailList(input: unknown) {
  if (Array.isArray(input)) return input.map((x) => normalizeEmail(x)).filter(Boolean);
  if (typeof input === 'string') return parseCsv(input).map((x) => normalizeEmail(x)).filter(Boolean);
  return [];
}

export function normalizePromoRules(input: unknown): PromoRule[] {
  const rows = Array.isArray(input) ? input : [];
  const map = new Map<string, PromoRule>();
  for (const r of rows) {
    const row = toRecord(r);
    const code = normalizePromoCode(String(row.code || ''));
    if (!code) continue;
    if (map.has(code)) continue;

    const maxUses = toOptionalNumber(row.maxUses);
    const maxUsesPerEmail = toOptionalNumber(row.maxUsesPerEmail);
    const discountAmount = toOptionalNumber(row.discountAmount);
    const discountPercentage = toOptionalNumber(row.discountPercentage);
    const eventIds = Array.isArray(row.eventIds) ? row.eventIds.map((x) => String(x)).filter(Boolean) : [];
    const mode = row.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp';
    const whitelistEmails = normalizeEmailList(row.whitelistEmails);

    map.set(code, {
      code,
      title: row.title ? String(row.title).trim() : '',
      active: !!row.active,
      mode,
      discountAmount: Number.isFinite(discountAmount) && discountAmount! >= 0 ? discountAmount : null,
      discountPercentage: Number.isFinite(discountPercentage) && discountPercentage! >= 0 && discountPercentage! <= 100 ? discountPercentage : null,
      maxUses: Number.isFinite(maxUses) && maxUses! >= 1 ? Math.floor(maxUses!) : null,
      maxUsesPerEmail: Number.isFinite(maxUsesPerEmail) && maxUsesPerEmail! >= 1 ? Math.floor(maxUsesPerEmail!) : null,
      eventIds,
      whitelistEmails,
      startsAt: row.startsAt ? String(row.startsAt) : null,
      endsAt: row.endsAt ? String(row.endsAt) : null,
      note: row.note ? String(row.note).trim() : '',
    });
  }
  return Array.from(map.values());
}
