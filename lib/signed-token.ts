import crypto from 'node:crypto';

function b64urlEncode(buf: Buffer) {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function b64urlDecode(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return Buffer.from(b64, 'base64');
}

function sign(data: string, secret: string) {
  return b64urlEncode(crypto.createHmac('sha256', secret).update(data).digest());
}

export function createSignedToken(payload: any, secret: string) {
  const json = JSON.stringify(payload);
  const body = b64urlEncode(Buffer.from(json, 'utf8'));
  const sig = sign(body, secret);
  return `${body}.${sig}`;
}

export function verifySignedToken(token: string, secret: string) {
  const [body, sig] = String(token || '').split('.', 2);
  if (!body || !sig) return { ok: false as const, error: 'Invalid token' };
  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return { ok: false as const, error: 'Invalid token' };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false as const, error: 'Invalid token' };
  const json = b64urlDecode(body).toString('utf8');
  const payload = JSON.parse(json);
  return { ok: true as const, payload };
}

