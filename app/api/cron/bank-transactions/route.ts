import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getBankTransactionsProvider } from '@/lib/bank-transactions/provider';

export const runtime = 'nodejs';

function normalizeError(e: any) {
  const err = e || {};
  return {
    message: String(err.message || err),
    name: err.name ? String(err.name) : '',
    code: err.code ? String(err.code) : '',
    stack: err.stack ? String(err.stack) : '',
  };
}

function parseRange(url: URL) {
  const limitRaw = Number(url.searchParams.get('limit') || 500);
  const limit = Math.min(5000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 500));

  const daysRaw = Number(url.searchParams.get('days') || 7);
  const days = Math.min(365, Math.max(0, Number.isFinite(daysRaw) ? daysRaw : 7));

  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');
  const to = toRaw ? new Date(toRaw) : new Date();
  const from = fromRaw ? new Date(fromRaw) : new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const fromOk = Number.isFinite(from.getTime()) ? from : new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const toOk = Number.isFinite(to.getTime()) ? to : new Date();

  return { from: fromOk, to: toOk, limit };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const provider = getBankTransactionsProvider();
  const supabase = getServerSupabase();
  const startedAt = new Date();
  const range = parseRange(url);

  const runRes = await supabase
    .from('bank_transactions_runs')
    .insert([
      {
        provider: provider.id,
        status: 'running',
        started_at: startedAt.toISOString(),
        meta: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          limit: range.limit,
        },
      },
    ])
    .select('id')
    .maybeSingle();

  if (runRes.error) {
    return NextResponse.json({ error: runRes.error.message || 'Failed to start run' }, { status: 500 });
  }

  const runId = String((runRes.data as any)?.id || '');
  if (!runId) return NextResponse.json({ error: 'Failed to start run' }, { status: 500 });

  try {
    const txs = await provider.fetchTransactions(range);

    const unique = new Map<string, (typeof txs)[number]>();
    for (const t of txs) {
      const id = String((t as any)?.providerTxId || '').trim();
      if (!id) continue;
      unique.set(id, t);
    }

    const rows = Array.from(unique.values()).map((t) => ({
      provider: provider.id,
      provider_tx_id: String(t.providerTxId),
      booked_at: new Date(String(t.bookedAt)).toISOString(),
      amount: Number(t.amount),
      currency: String(t.currency || 'CZK'),
      account_iban: t.accountIban ? String(t.accountIban) : null,
      counterparty_iban: t.counterpartyIban ? String(t.counterpartyIban) : null,
      counterparty_name: t.counterpartyName ? String(t.counterpartyName) : null,
      vs: t.vs ? String(t.vs) : null,
      ks: t.ks ? String(t.ks) : null,
      ss: t.ss ? String(t.ss) : null,
      message: t.message ? String(t.message) : null,
      raw: t.raw && typeof t.raw === 'object' ? t.raw : {},
      updated_at: new Date().toISOString(),
    }));

    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const up = await supabase.from('bank_transactions').upsert(batch as any, { onConflict: 'provider,provider_tx_id' });
      if (up.error) throw up.error;
      upserted += batch.length;
    }

    const finishedAt = new Date();
    await supabase
      .from('bank_transactions_runs')
      .update({
        status: 'success',
        finished_at: finishedAt.toISOString(),
        fetched_count: txs.length,
        upserted_count: upserted,
        skipped_count: Math.max(0, txs.length - unique.size),
        error: null,
      })
      .eq('id', runId);

    return NextResponse.json({
      ok: true,
      provider: provider.id,
      runId,
      fetched: txs.length,
      upserted,
      skipped: Math.max(0, txs.length - unique.size),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    });
  } catch (e: any) {
    const finishedAt = new Date();
    const info = normalizeError(e);
    await supabase
      .from('bank_transactions_runs')
      .update({
        status: 'error',
        finished_at: finishedAt.toISOString(),
        error: info.message,
        meta: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
          limit: range.limit,
          error: info,
        },
      })
      .eq('id', runId);

    return NextResponse.json({ ok: false, provider: provider.id, runId, error: info.message }, { status: 500 });
  }
}
