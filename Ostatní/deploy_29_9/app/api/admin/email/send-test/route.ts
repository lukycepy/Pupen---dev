import { NextResponse } from 'next/server';
import { getMailerDebugInfoWithSettings, getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { listEmailTemplates, type EmailTemplateKey } from '@/lib/email/templates';
import { requireAdmin } from '@/lib/server-auth';
import net from 'net';
import { lookup } from 'dns/promises';
import tls from 'tls';

export const runtime = 'nodejs';

interface NetworkCheckError {
  message: string;
  code?: string;
}

interface TcpResolvedInfo {
  address: string;
  family: number;
}

interface TcpCheckResult {
  ok: boolean;
  host: string;
  port: number;
  ms: number;
  resolved?: TcpResolvedInfo | null;
  error?: NetworkCheckError;
}

interface TlsCertificateInfo {
  subject?: unknown;
  issuer?: unknown;
  subjectaltname?: string;
  valid_from?: string;
  valid_to?: string;
  fingerprint256?: string;
  serialNumber?: string;
}

interface TlsCheckResult {
  ok: boolean;
  host: string;
  port: number;
  ms: number;
  authorized?: boolean;
  authorizationError?: string;
  cert?: TlsCertificateInfo | null;
  error?: NetworkCheckError;
}

interface SendTestErrorDetails {
  message?: string;
  code?: string;
  errno?: string;
  syscall?: string;
  address?: string;
  port?: number;
  command?: string;
  responseCode?: number;
}

interface SendTestBody {
  to?: unknown;
  templateKey?: unknown;
  variables?: unknown;
}

interface MailerDebugInfo {
  host?: unknown;
  port?: unknown;
  secure?: unknown;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

function getErrorDetails(error: unknown): SendTestErrorDetails {
  const record = toRecord(error);
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    errno: typeof record.errno === 'string' ? record.errno : undefined,
    syscall: typeof record.syscall === 'string' ? record.syscall : undefined,
    address: typeof record.address === 'string' ? record.address : undefined,
    port: typeof record.port === 'number' ? record.port : undefined,
    command: typeof record.command === 'string' ? record.command : undefined,
    responseCode: typeof record.responseCode === 'number' ? record.responseCode : undefined,
  };
}

function toMailerDebugInfo(value: unknown): MailerDebugInfo {
  return toRecord(value);
}

function isEmailTemplateKey(value: string): value is EmailTemplateKey {
  return listEmailTemplates().some((template) => template.key === value);
}

async function tcpConnectCheck(host: string, port: number, timeoutMs = 6500) {
  const startedAt = Date.now();
  const safeHost = String(host || '').trim();
  const safePort = Number(port);
  if (!safeHost || !Number.isFinite(safePort) || safePort <= 0) {
    return { ok: false, host: safeHost, port: safePort, ms: 0, error: { message: 'Missing host/port' } } satisfies TcpCheckResult;
  }

  let resolved: TcpResolvedInfo | null = null;
  try {
    const r = await lookup(safeHost);
    resolved = { address: r.address, family: r.family };
  } catch (error: unknown) {
    const details = getErrorDetails(error);
    return {
      ok: false,
      host: safeHost,
      port: safePort,
      ms: Date.now() - startedAt,
      resolved: null,
      error: { message: getErrorMessage(error), code: details.code || '' },
    } satisfies TcpCheckResult;
  }

  return await new Promise<TcpCheckResult>((resolve) => {
    const socket = net.connect({ host: safeHost, port: safePort });
    const done = (result: TcpCheckResult) => {
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

    socket.once('error', (error: Error) => {
      clearTimeout(timeout);
      const details = getErrorDetails(error);
      done({
        ok: false,
        host: safeHost,
        port: safePort,
        resolved,
        ms: Date.now() - startedAt,
        error: { message: getErrorMessage(error), code: details.code || '' },
      });
    });
  });
}

async function tlsHandshakeCheck(host: string, port: number, timeoutMs = 6500) {
  const startedAt = Date.now();
  const safeHost = String(host || '').trim();
  const safePort = Number(port);
  if (!safeHost || !Number.isFinite(safePort) || safePort <= 0) {
    return { ok: false, host: safeHost, port: safePort, ms: 0, error: { message: 'Missing host/port' } } satisfies TlsCheckResult;
  }

  return await new Promise<TlsCheckResult>((resolve) => {
    const socket = tls.connect({
      host: safeHost,
      port: safePort,
      servername: safeHost,
      rejectUnauthorized: false,
    });

    const done = (result: TlsCheckResult) => {
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
      const cert = socket.getPeerCertificate(true) as TlsCertificateInfo | null;
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

    socket.once('error', (error: Error) => {
      clearTimeout(timeout);
      const details = getErrorDetails(error);
      done({
        ok: false,
        host: safeHost,
        port: safePort,
        ms: Date.now() - startedAt,
        error: { message: getErrorMessage(error), code: details.code || '' },
      });
    });
  });
}

export async function POST(req: Request) {
  try {
    const { profile } = await requireAdmin(req);
    if (!profile?.can_manage_admins) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const { to, templateKey, variables } = body as SendTestBody;
    if (!to || !templateKey) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const parsedTemplateKey = String(templateKey).trim();
    if (!isEmailTemplateKey(parsedTemplateKey)) {
      return NextResponse.json({ error: 'Invalid template key' }, { status: 400 });
    }

    const debug = toMailerDebugInfo(await getMailerDebugInfoWithSettings());
    const host = String(debug.host || '');
    const port = Number(debug.port || 0);
    const tcp = await tcpConnectCheck(host, port);
    const tlsInfo = debug.secure === true || port === 465 ? await tlsHandshakeCheck(host, port).catch(() => null) : null;

    const { subject, html } = await renderEmailTemplateWithDbOverride(parsedTemplateKey, toRecord(variables));
    const transporter = await getMailerWithSettings();
    const from = await getSenderFromSettings();

    let verified: boolean | null = null;
    let verifyError: SendTestErrorDetails | null = null;
    try {
      verified = await transporter.verify();
    } catch (error: unknown) {
      verified = false;
      verifyError = {
        message: getErrorMessage(error),
        ...getErrorDetails(error),
      };
    }

    await transporter.sendMail({
      from,
      to: String(to),
      subject: `[TEST] ${subject}`,
      html,
    });

    return NextResponse.json({ ok: true, verified, verifyError, tcp, tls: tlsInfo, debug });
  } catch (error: unknown) {
    const debug = toMailerDebugInfo(await getMailerDebugInfoWithSettings());
    const host = String(debug.host || '');
    const port = Number(debug.port || 0);
    const tcp = await tcpConnectCheck(host, port).catch(() => null);
    const tlsInfo = debug.secure === true || port === 465 ? await tlsHandshakeCheck(host, port).catch(() => null) : null;
    const details = getErrorDetails(error);
    return NextResponse.json(
      {
        error: getErrorMessage(error),
        debug,
        tcp,
        tls: tlsInfo,
        details,
      },
      { status: 500 },
    );
  }
}
