import { getPublicBaseUrl } from '@/lib/public-base-url';

function firstHeaderValue(value: string | null) {
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .find(Boolean) || null;
}

function originFromUrlLike(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getRequestOrigin(req: Request) {
  const origin = originFromUrlLike(req.headers.get('origin'));
  if (origin) return origin;
  return originFromUrlLike(req.headers.get('referer'));
}

function forwardedOrigin(req: Request) {
  const proto = firstHeaderValue(req.headers.get('x-forwarded-proto'));
  const host = firstHeaderValue(req.headers.get('x-forwarded-host')) || firstHeaderValue(req.headers.get('host'));
  if (!host) return null;
  return originFromUrlLike(`${proto || 'https'}://${host}`);
}

function allowedOrigins(req: Request) {
  const out = new Set<string>();

  try {
    out.add(new URL(req.url).origin);
  } catch {}

  const publicOrigin = originFromUrlLike(getPublicBaseUrl());
  if (publicOrigin) out.add(publicOrigin);

  const forwarded = forwardedOrigin(req);
  if (forwarded) out.add(forwarded);

  return out;
}

export function isSameSiteRequest(req: Request) {
  const origin = getRequestOrigin(req);
  const secFetchSite = String(req.headers.get('sec-fetch-site') || '').toLowerCase();
  if (!origin) {
    if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') return true;
    return process.env.NODE_ENV !== 'production';
  }

  try {
    if (allowedOrigins(req).has(origin)) return true;

    if (process.env.NODE_ENV !== 'production') {
      const host = new URL(origin).hostname;
      if (host === 'localhost' || host === '127.0.0.1') return true;
    }
  } catch {}

  return false;
}
