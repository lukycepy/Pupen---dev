/**
 * =============================================================
 *  Endpoint pro příjem formulářů z aplikace Linka
 *  Výsledná adresa: https://www.pupen.org/apps/odesli-mail.php
 * =============================================================
 *
 *  Aplikace sem posílá JSON přes HTTPS POST:
 *    { from, to, subject, message, replyTo, data }
 *
 *  Endpoint zprávu přepošle e-mailem přes SMTP, které už web
 *  používá (bere se z administrace / proměnných prostředí).
 *  Nikde v kódu tedy není žádné heslo.
 */

import { NextResponse } from 'next/server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';
import { getServerSupabase } from '@/lib/supabase-server';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { sendMailWithQueueFallback } from '@/lib/email/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POVOLENI_PRIIMCI = new Set(['tech@pupen.org', 'info@pupen.org']);
const VYCHOZI_PRIIMCE = 'tech@pupen.org';
const MAX_PREDMET = 200;
const MAX_ZPRAVA = 20000;

const CORS_HLAVICKY: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
};

function odpoved(telo: Record<string, unknown>, status = 200) {
  return NextResponse.json(telo, { status, headers: CORS_HLAVICKY });
}

function ocistiHlavicku(hodnota: unknown, max: number): string {
  return String(hodnota ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, max);
}

function jePlatnyEmail(hodnota: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hodnota);
}

function prevedNaHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HLAVICKY });
}

export async function POST(req: Request) {
  try {
    // Mobilní aplikace neposílá hlavičku Origin, takže sameSite musí být vypnuto.
    const strazce = await guardPublicJsonPost(req, {
      keyPrefix: 'linka-mail',
      windowMs: 600_000,
      max: 5,
      sameSite: false,
      honeypot: false,
      tooManyMessage: 'Příliš mnoho zpráv z tohoto zařízení. Zkuste to prosím později.',
    });
    if (!strazce.ok) return strazce.response;

    const predmet = ocistiHlavicku(strazce.body.subject, MAX_PREDMET) || '[Linka] Nový dotaz';
    const zprava = String(strazce.body.message ?? '').trim().slice(0, MAX_ZPRAVA);
    const replyToRaw = ocistiHlavicku(strazce.body.replyTo, 200);
    const replyTo = jePlatnyEmail(replyToRaw) ? replyToRaw : '';
    const maStrukturovanaData = Boolean(strazce.body.data);

    if (!zprava) {
      return odpoved({ success: false, error: 'Zpráva je prázdná.' }, 400);
    }

    const pozadovany = ocistiHlavicku(strazce.body.to, 200).toLowerCase();
    const prijemce = POVOLENI_PRIIMCI.has(pozadovany) ? pozadovany : VYCHOZI_PRIIMCE;

    const supabase = getServerSupabase();
    const dopravce = await getMailerWithSettingsOrQueueTransporter();
    const odesilatel = await getSenderFromSettings();

    const vysledek = await sendMailWithQueueFallback({
      transporter: dopravce,
      supabase,
      meta: {
        kind: 'linka-support',
        source: 'app',
        ...(maStrukturovanaData ? { ma_navrh_kontaktu: true } : {}),
      },
      message: {
        from: odesilatel,
        to: prijemce,
        replyTo: replyTo || undefined,
        subject: predmet,
        text: zprava,
        html: `<pre style="font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap;margin:0">${prevedNaHtml(zprava)}</pre>`,
      },
    });

    if (!vysledek.ok && !vysledek.queued) {
      return odpoved({ success: false, error: 'Zprávu se nepodařilo odeslat.' }, 502);
    }

    return odpoved({ success: true, ok: true, queued: !vysledek.ok });
  } catch (chyba: unknown) {
    const popis = chyba instanceof Error ? chyba.message : 'Neznámá chyba';
    return odpoved({ success: false, error: popis }, 500);
  }
}
