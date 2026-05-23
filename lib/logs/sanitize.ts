const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_RE = /(^|_|-)(password|pass|pwd|secret|token|access_token|refresh_token|authorization|cookie|set-cookie|api_key|apikey|client_secret|service_role)(_|-|$)/i;

function sanitizeString(input: string) {
  let s = String(input ?? '');
  s = s.replace(/\bBearer\s+([A-Za-z0-9\-._~+/]+=*)/gi, `Bearer ${REDACTED}`);
  s = s.replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, REDACTED);
  s = s.replace(
    /\b(access_token|refresh_token|token|apikey|api_key|password|pass|secret|client_secret)=([^&\s]+)/gi,
    (_m, k) => `${k}=${REDACTED}`,
  );
  return s;
}

function sanitizeUrl(input: string) {
  try {
    const u = new URL(String(input));
    for (const [k] of u.searchParams) {
      if (SENSITIVE_KEY_RE.test(k) || /^(code|key|signature|sig|state)$/i.test(k)) {
        u.searchParams.set(k, REDACTED);
      }
    }
    return sanitizeString(u.toString());
  } catch {
    return sanitizeString(String(input ?? ''));
  }
}

function isPlainObject(value: any) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function sanitizeLogValue(value: any, opts?: { depth?: number }) {
  const depth = Math.max(0, Math.min(20, Number(opts?.depth ?? 6)));

  const walk = (v: any, d: number): any => {
    if (v == null) return v;
    if (typeof v === 'string') return sanitizeString(v);
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (v instanceof Date) return v.toISOString();
    if (typeof v === 'bigint') return String(v);

    if (Array.isArray(v)) {
      if (d <= 0) return '[…]';
      return v.slice(0, 200).map((x) => walk(x, d - 1));
    }

    if (isPlainObject(v)) {
      if (d <= 0) return '{…}';
      const out: any = {};
      for (const [k, vv] of Object.entries(v)) {
        if (SENSITIVE_KEY_RE.test(k)) {
          out[k] = REDACTED;
        } else if (k === 'url' || k === 'href') {
          out[k] = sanitizeUrl(String(vv ?? ''));
        } else {
          out[k] = walk(vv, d - 1);
        }
      }
      return out;
    }

    try {
      return sanitizeString(JSON.stringify(v));
    } catch {
      return sanitizeString(String(v));
    }
  };

  return walk(value, depth);
}

export function sanitizeLogMessage(input: any) {
  return sanitizeString(String(input ?? ''));
}

export function sanitizeLogUrl(input: any) {
  return sanitizeUrl(String(input ?? ''));
}
