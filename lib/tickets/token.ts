export function normalizeTicketToken(raw: unknown) {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (value.startsWith('PUPEN-TICKET:')) {
    return value.replace('PUPEN-TICKET:', '').trim();
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const queryToken = String(url.searchParams.get('token') || '').trim();
      if (queryToken) return queryToken;
      const hashToken = String(url.hash || '').replace(/^#/, '').trim();
      if (hashToken) return hashToken;
    } catch {}
  }

  return value;
}
