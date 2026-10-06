export type TicketBlacklistEntry = {
  value: string;
  note?: string;
};

export function normalizeEmail(input: string) {
  return String(input || '').trim().toLowerCase();
}

export function normalizeEntryValue(input: string) {
  return String(input || '').trim().toLowerCase();
}

export function isEmailBlacklisted(email: string, entries: TicketBlacklistEntry[]) {
  const e = normalizeEmail(email);
  if (!e) return false;
  const at = e.lastIndexOf('@');
  const domain = at >= 0 ? e.slice(at + 1) : '';

  for (const raw of entries || []) {
    const v = normalizeEntryValue(raw?.value || '');
    if (!v) continue;
    if (v.includes('@')) {
      if (v === e) return true;
      continue;
    }
    if (domain && v === domain) return true;
  }
  return false;
}

