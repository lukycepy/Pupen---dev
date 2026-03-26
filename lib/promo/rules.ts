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

export function normalizeEmailList(input: any) {
  if (Array.isArray(input)) return input.map((x) => normalizeEmail(x)).filter(Boolean);
  if (typeof input === 'string') return parseCsv(input).map((x) => normalizeEmail(x)).filter(Boolean);
  return [];
}

export function normalizePromoRules(input: any): PromoRule[] {
  const rows = Array.isArray(input) ? input : [];
  const map = new Map<string, PromoRule>();
  for (const r of rows) {
    const code = normalizePromoCode(r?.code || '');
    if (!code) continue;
    if (map.has(code)) continue;

    const maxUses = r?.maxUses === '' || r?.maxUses == null ? null : Number(r.maxUses);
    const maxUsesPerEmail = r?.maxUsesPerEmail === '' || r?.maxUsesPerEmail == null ? null : Number(r.maxUsesPerEmail);
    const discountAmount = r?.discountAmount === '' || r?.discountAmount == null ? null : Number(r.discountAmount);
    const discountPercentage = r?.discountPercentage === '' || r?.discountPercentage == null ? null : Number(r.discountPercentage);
    const eventIds = Array.isArray(r?.eventIds) ? r.eventIds.map((x: any) => String(x)).filter(Boolean) : [];
    const mode = r?.mode === 'per_attendee' ? 'per_attendee' : 'per_rsvp';
    const whitelistEmails = normalizeEmailList(r?.whitelistEmails);

    map.set(code, {
      code,
      title: r?.title ? String(r.title).trim() : '',
      active: !!r?.active,
      mode,
      discountAmount: Number.isFinite(discountAmount) && discountAmount! >= 0 ? discountAmount : null,
      discountPercentage: Number.isFinite(discountPercentage) && discountPercentage! >= 0 && discountPercentage! <= 100 ? discountPercentage : null,
      maxUses: Number.isFinite(maxUses) && maxUses! >= 1 ? Math.floor(maxUses!) : null,
      maxUsesPerEmail: Number.isFinite(maxUsesPerEmail) && maxUsesPerEmail! >= 1 ? Math.floor(maxUsesPerEmail!) : null,
      eventIds,
      whitelistEmails,
      startsAt: r?.startsAt ? String(r.startsAt) : null,
      endsAt: r?.endsAt ? String(r.endsAt) : null,
      note: r?.note ? String(r.note).trim() : '',
    });
  }
  return Array.from(map.values());
}
