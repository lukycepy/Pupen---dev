import { getPublicBaseUrl } from '@/lib/public-base-url';

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

export function isSameSiteRequest(req: Request) {
  const origin = getRequestOrigin(req);
  if (!origin) return process.env.NODE_ENV !== 'production';

  try {
    const allowed = new URL(getPublicBaseUrl()).origin;
    if (origin === allowed) return true;

    if (process.env.NODE_ENV !== 'production') {
      const host = new URL(origin).hostname;
      if (host === 'localhost' || host === '127.0.0.1') return true;
    }
  } catch {}

  return false;
}
