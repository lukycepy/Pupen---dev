import { NextResponse } from 'next/server';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import { isSameSiteRequest } from '@/lib/request-origin';

type GuardOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  sameSite?: boolean;
  honeypot?: boolean;
  honeypotResponse?: any;
  tooManyPayload?: any;
  forbiddenPayload?: any;
  tooManyMessage?: string;
  forbiddenMessage?: string;
};

type GuardOk = { ok: true; ip: string; body: any };
type GuardFail = { ok: false; response: NextResponse };

function parseFormBody(raw: string) {
  const sp = new URLSearchParams(raw);
  const out: any = {};
  for (const [k, v] of sp.entries()) {
    if (k in out) continue;
    out[k] = v;
  }
  return out;
}

export async function guardPublicJsonPost(req: Request, opts: GuardOptions): Promise<GuardOk | GuardFail> {
  const ip = getClientIp(req) || 'unknown';
  const rl = await rateLimit({ bucket: opts.keyPrefix, key: ip, windowMs: opts.windowMs, max: opts.max });
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ...(opts.tooManyPayload || {}), error: opts.tooManyMessage || 'Příliš mnoho požadavků, zkuste to později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      ),
    };
  }

  if (opts.sameSite !== false && !isSameSiteRequest(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ...(opts.forbiddenPayload || {}), error: opts.forbiddenMessage || 'Zakázaný požadavek.' },
        { status: 403 },
      ),
    };
  }

  const body = await req.json().catch(() => ({}));

  if (opts.honeypot !== false) {
    const hp = String(body?.hp || body?.website || '').trim();
    if (hp) {
      return {
        ok: false,
        response: NextResponse.json(opts.honeypotResponse ?? { ok: true }),
      };
    }
  }

  return { ok: true, ip, body };
}

export async function guardPublicPostAny(req: Request, opts: GuardOptions): Promise<GuardOk | GuardFail> {
  const ip = getClientIp(req) || 'unknown';
  const rl = await rateLimit({ bucket: opts.keyPrefix, key: ip, windowMs: opts.windowMs, max: opts.max });
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ...(opts.tooManyPayload || {}), error: opts.tooManyMessage || 'Příliš mnoho požadavků, zkuste to později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      ),
    };
  }

  if (opts.sameSite !== false && !isSameSiteRequest(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ...(opts.forbiddenPayload || {}), error: opts.forbiddenMessage || 'Zakázaný požadavek.' },
        { status: 403 },
      ),
    };
  }

  const ct = String(req.headers.get('content-type') || '').toLowerCase();
  const body = ct.includes('application/json')
    ? await req.json().catch(() => ({}))
    : parseFormBody(await req.text().catch(() => ''));

  if (opts.honeypot !== false) {
    const hp = String((body as any)?.hp || (body as any)?.website || '').trim();
    if (hp) {
      return { ok: false, response: NextResponse.json(opts.honeypotResponse ?? { ok: true }) };
    }
  }

  return { ok: true, ip, body };
}

type GuardNoBodyOk = { ok: true; ip: string };
type GuardNoBodyFail = { ok: false; response: NextResponse };

export async function guardPublicPostNoBody(req: Request, opts: Omit<GuardOptions, 'honeypot' | 'honeypotResponse'>): Promise<GuardNoBodyOk | GuardNoBodyFail> {
  const ip = getClientIp(req) || 'unknown';
  const rl = await rateLimit({ bucket: opts.keyPrefix, key: ip, windowMs: opts.windowMs, max: opts.max });
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ...(opts.tooManyPayload || {}), error: opts.tooManyMessage || 'Příliš mnoho požadavků, zkuste to později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      ),
    };
  }

  if (opts.sameSite !== false && !isSameSiteRequest(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ...(opts.forbiddenPayload || {}), error: opts.forbiddenMessage || 'Zakázaný požadavek.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, ip };
}

type SilentOkOptions = GuardOptions & {
  okPayload?: any;
  okStatus?: number;
};

export async function guardPublicJsonPostSilentOk(req: Request, opts: SilentOkOptions): Promise<GuardOk | GuardFail> {
  const okPayload = opts.okPayload ?? { ok: true };
  const okStatus = typeof opts.okStatus === 'number' ? opts.okStatus : 200;
  const g = await guardPublicJsonPost(req, opts);
  if (g.ok) return g;

  const headers = new Headers(g.response.headers);
  return { ok: false, response: NextResponse.json(okPayload, { status: okStatus, headers }) };
}

type GuardGetOk = { ok: true; ip: string };
type GuardGetFail = { ok: false; response: NextResponse };

type GuardGetOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  sameSite?: boolean;
  tooManyPayload?: any;
  forbiddenPayload?: any;
  tooManyMessage?: string;
  forbiddenMessage?: string;
};

export async function guardPublicGet(req: Request, opts: GuardGetOptions): Promise<GuardGetOk | GuardGetFail> {
  const ip = getClientIp(req) || 'unknown';
  const rl = await rateLimit({ bucket: opts.keyPrefix, key: ip, windowMs: opts.windowMs, max: opts.max });
  if (!rl.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ...(opts.tooManyPayload || {}), error: opts.tooManyMessage || 'Příliš mnoho požadavků, zkuste to později.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      ),
    };
  }

  if (opts.sameSite === true && !isSameSiteRequest(req)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ...(opts.forbiddenPayload || {}), error: opts.forbiddenMessage || 'Zakázaný požadavek.' },
        { status: 403 },
      ),
    };
  }

  return { ok: true, ip };
}

export async function guardPublicGetRaw(
  req: Request,
  opts: Omit<GuardGetOptions, 'tooManyPayload' | 'forbiddenPayload' | 'tooManyMessage' | 'forbiddenMessage'> & {
    tooManyStatus?: number;
    forbiddenStatus?: number;
  },
): Promise<GuardGetOk | GuardGetFail> {
  const ip = getClientIp(req) || 'unknown';
  const rl = await rateLimit({ bucket: opts.keyPrefix, key: ip, windowMs: opts.windowMs, max: opts.max });
  if (!rl.ok) {
    return { ok: false, response: new NextResponse(null, { status: typeof opts.tooManyStatus === 'number' ? opts.tooManyStatus : 429 }) };
  }

  if (opts.sameSite === true && !isSameSiteRequest(req)) {
    return { ok: false, response: new NextResponse(null, { status: typeof opts.forbiddenStatus === 'number' ? opts.forbiddenStatus : 403 }) };
  }

  return { ok: true, ip };
}
