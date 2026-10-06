export function getPublicBaseUrl() {
  const raw = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim() || 'https://pupen.org';
  const withProto = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  return withProto.replace(/\/+$/, '');
}

export function getPublicHost() {
  try {
    return new URL(getPublicBaseUrl()).hostname;
  } catch {
    return 'pupen.org';
  }
}

