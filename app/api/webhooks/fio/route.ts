import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';

type NormalizedTx = {
  id: string | null;
  date: string | null;
  amount: number | null;
  currency: string | null;
  variableSymbol: string | null;
  message: string | null;
};

function pickTokenCandidates(tx: NormalizedTx) {
  const candidates = new Set<string>();
  const vs = (tx.variableSymbol || '').trim();
  if (vs) candidates.add(vs);

  const msg = (tx.message || '').trim();
  if (msg) {
    const matches = msg.match(/[A-Z0-9]{8,}/g) || [];
    matches.forEach((m) => candidates.add(m));
  }
  return Array.from(candidates);
}

function normalizeFioPayload(payload: any): NormalizedTx[] {
  const txs: any[] =
    payload?.accountStatement?.transactionList?.transaction ||
    payload?.transactions ||
    payload?.transactionList ||
    [];

  return txs
    .map((t) => {
      if (Array.isArray(t?.column)) {
        const map = new Map<string, any>();
        t.column.forEach((c: any) => map.set(String(c.name), c.value));
        const id = map.get('ID pohybu') ?? map.get('ID') ?? null;
        const date = map.get('Datum') ?? null;
        const amount = map.get('Objem') ?? map.get('Amount') ?? null;
        const currency = map.get('Měna') ?? map.get('Currency') ?? null;
        const vs = map.get('VS') ?? map.get('VarSym') ?? null;
        const msg = map.get('Zpráva pro příjemce') ?? map.get('Comment') ?? map.get('Message') ?? null;
        return {
          id: id ? String(id) : null,
          date: date ? String(date) : null,
          amount: amount != null ? Number(amount) : null,
          currency: currency ? String(currency) : null,
          variableSymbol: vs ? String(vs) : null,
          message: msg ? String(msg) : null,
        } satisfies NormalizedTx;
      }

      return {
        id: t?.id != null ? String(t.id) : null,
        date: t?.date != null ? String(t.date) : null,
        amount: t?.amount != null ? Number(t.amount) : null,
        currency: t?.currency != null ? String(t.currency) : null,
        variableSymbol: t?.variableSymbol != null ? String(t.variableSymbol) : (t?.vs != null ? String(t.vs) : null),
        message: t?.message != null ? String(t.message) : (t?.comment != null ? String(t.comment) : null),
      } satisfies NormalizedTx;
    })
    .filter((t) => (t.amount || 0) > 0);
}

async function pullFromFio(fioToken: string) {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const url = `https://fioapi.fio.cz/v1/rest/periods/${encodeURIComponent(fioToken)}/${ymd(from)}/${ymd(to)}/transactions.json`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`Fio API ${res.status}`);
  return res.json();
}

export async function POST(req: Request) {
  try {
    const secret = process.env.PUPEN_FIO_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers.get('x-pupen-signature');
      if (!provided || provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const supabase = getServerSupabase();

    let payload = body;
    if (body?.mode === 'pull') {
      const { data: settings } = await supabase.from('payment_settings').select('fio_api_token').single();
      const token = settings?.fio_api_token;
      if (!token) return NextResponse.json({ error: 'Missing Fio token' }, { status: 400 });
      payload = await pullFromFio(token);
    }

    const txs = normalizeFioPayload(payload);
    let matched = 0;
    let skipped = 0;

    for (const tx of txs) {
      const candidates = pickTokenCandidates(tx);
      if (candidates.length === 0) {
        skipped += 1;
        continue;
      }

      let updated = false;

      for (const token of candidates) {
        const now = new Date();
        const rsvpRes = await supabase
          .from('rsvp')
          .select('id, status, expires_at, email, name, attendees, payment_method, event_id, qr_token')
          .eq('qr_token', token)
          .limit(1)
          .maybeSingle();

        const r = rsvpRes.data;
        if (!r) continue;
        if (r.status === 'cancelled') continue;
        if (r.status === 'confirmed') continue;
        if (r.expires_at && new Date(r.expires_at) <= now) continue;

        const { error: updErr } = await supabase.from('rsvp').update({ status: 'confirmed', expires_at: null }).eq('id', r.id);
        if (updErr) throw updErr;

        matched += 1;
        updated = true;

        try {
          await supabase.from('admin_logs').insert([
            {
              admin_email: 'fio-webhook',
              admin_name: 'Fio',
              action: 'fio-webhook',
              target_id: r.id,
              details: { message: `Potvrzena platba pro RSVP: ${r.id}`, tx },
            },
          ]);
        } catch {}

        break;
      }

      if (!updated) skipped += 1;
    }

    return NextResponse.json({ ok: true, matched, skipped, total: txs.length });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 500 });
  }
}
