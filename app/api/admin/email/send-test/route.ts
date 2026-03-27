import { NextResponse } from 'next/server';
import { getMailerDebugInfoWithSettings, getMailerWithSettings, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { requireAdmin } from '@/lib/server-auth';
import net from 'net';
import { lookup } from 'dns/promises';

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
    const tcp = await tcpConnectCheck(String((debug as any)?.host || ''), Number((debug as any)?.port || 0));

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

    return NextResponse.json({ ok: true, verified, verifyError, tcp, debug });
  } catch (e: any) {
    const debug = await getMailerDebugInfoWithSettings();
    const tcp = await tcpConnectCheck(String((debug as any)?.host || ''), Number((debug as any)?.port || 0)).catch(() => null);
    return NextResponse.json(
      {
        error: e?.message || 'Error',
        debug,
        tcp,
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
