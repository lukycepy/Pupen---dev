import { NextResponse } from 'next/server';
import { getMailerDebugInfoWithSettings, getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { requireAdmin } from '@/lib/server-auth';
import net from 'net';
import { lookup } from 'dns/promises';
import tls from 'tls';

export const runtime = 'nodejs';

async function tcpConnectCheck(host: string, port: number, timeoutMs = 6500) {
  const startedAt = Date.now();
  const safeHost = String(host || '').trim();
  const safePort = Number(port);
  if (!safeHost || !Number.isFinite(safePort) || safePort <= 0) {
    return { ok: false, host: safeHost, port: safePort, ms: 0, error: { message: 'Missing host/port' } };
  }

  let resolved: any = null;
  try {
    const r = await lookup(safeHost);
    resolved = { address: r.address, family: r.family };
  } catch (e: any) {
    return {
      ok: false,
      host: safeHost,
      port: safePort,
      ms: Date.now() - startedAt,
      resolved: null,
      error: { message: String(e?.message || e), code: e?.code ? String(e.code) : '' },
    };
  }

  return await new Promise<any>((resolve) => {
    const socket = net.connect({ host: safeHost, port: safePort });
    const done = (result: any) => {
      try {
        socket.destroy();
      } catch {}
      resolve(result);
    };
    const timeout = setTimeout(() => {
      done({
        ok: false,
        host: safeHost,
        port: safePort,
        resolved,
        ms: Date.now() - startedAt,
        error: { message: 'Connection timeout', code: 'ETIMEDOUT' },
      });
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timeout);
      done({ ok: true, host: safeHost, port: safePort, resolved, ms: Date.now() - startedAt });
    });

    socket.once('error', (e: any) => {
      clearTimeout(timeout);
      done({
        ok: false,
        host: safeHost,
        port: safePort,
        resolved,
        ms: Date.now() - startedAt,
        error: { message: String(e?.message || e), code: e?.code ? String(e.code) : '' },
      });
    });
  });
}

async function tlsHandshakeCheck(host: string, port: number, timeoutMs = 6500) {
  const startedAt = Date.now();
  const safeHost = String(host || '').trim();
  const safePort = Number(port);
  if (!safeHost || !Number.isFinite(safePort) || safePort <= 0) {
    return { ok: false, host: safeHost, port: safePort, ms: 0, error: { message: 'Missing host/port' } };
  }

  return await new Promise<any>((resolve) => {
    const socket = tls.connect({
      host: safeHost,
      port: safePort,
      servername: safeHost,
      rejectUnauthorized: false,
    });

    const done = (result: any) => {
      try {
        socket.destroy();
      } catch {}
      resolve(result);
    };

    const timeout = setTimeout(() => {
      done({
        ok: false,
        host: safeHost,
        port: safePort,
        ms: Date.now() - startedAt,
        error: { message: 'TLS handshake timeout', code: 'ETIMEDOUT' },
      });
    }, timeoutMs);

    socket.once('secureConnect', () => {
      clearTimeout(timeout);
      const cert: any = (socket as any).getPeerCertificate?.(true) || null;
      done({
        ok: true,
        host: safeHost,
        port: safePort,
        ms: Date.now() - startedAt,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ? String(socket.authorizationError) : '',
        cert: cert
          ? {
              subject: cert.subject,
              issuer: cert.issuer,
              subjectaltname: cert.subjectaltname,
              valid_from: cert.valid_from,
              valid_to: cert.valid_to,
              fingerprint256: cert.fingerprint256,
              serialNumber: cert.serialNumber,
            }
          : null,
      });
    });

    socket.once('error', (e: any) => {
      clearTimeout(timeout);
      done({
        ok: false,
        host: safeHost,
        port: safePort,
        ms: Date.now() - startedAt,
        error: { message: String(e?.message || e), code: e?.code ? String(e.code) : '' },
      });
    });
  });
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { to, templateKey, variables } = body || {};
    if (!to || !templateKey) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const debug = await getMailerDebugInfoWithSettings();
    const host = String((debug as any)?.host || '');
    const port = Number((debug as any)?.port || 0);
    const tcp = await tcpConnectCheck(host, port);
    const tlsInfo = (debug as any)?.secure === true || port === 465 ? await tlsHandshakeCheck(host, port).catch(() => null) : null;

    const { subject, html } = await renderEmailTemplateWithDbOverride(templateKey, variables || {});
    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    let verified: boolean | null = null;
    let verifyError: any = null;
    try {
      verified = await transporter.verify();
    } catch (e: any) {
      verified = false;
      verifyError = {
        message: String(e?.message || e),
        code: e?.code,
        errno: e?.errno,
        syscall: e?.syscall,
        address: e?.address,
        port: e?.port,
        command: e?.command,
        responseCode: e?.responseCode,
      };
    }

    await transporter.sendMail({
      from,
      to,
      subject: `[TEST] ${subject}`,
      html,
    });

    return NextResponse.json({ ok: true, verified, verifyError, tcp, tls: tlsInfo, debug });
  } catch (e: any) {
    const debug = await getMailerDebugInfoWithSettings();
    const host = String((debug as any)?.host || '');
    const port = Number((debug as any)?.port || 0);
    const tcp = await tcpConnectCheck(host, port).catch(() => null);
    const tlsInfo = (debug as any)?.secure === true || port === 465 ? await tlsHandshakeCheck(host, port).catch(() => null) : null;
    return NextResponse.json(
      {
        error: e?.message || 'Error',
        debug,
        tcp,
        tls: tlsInfo,
        details: {
          code: e?.code,
          errno: e?.errno,
          syscall: e?.syscall,
          address: e?.address,
          port: e?.port,
          command: e?.command,
          responseCode: e?.responseCode,
        },
      },
      { status: 500 },
    );
  }
}
