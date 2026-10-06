import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { getBankTransactionsProvider } from '@/lib/bank-transactions/provider';
import type { BankTransaction } from '@/lib/bank-transactions/provider';

export const runtime = 'nodejs';

interface BankTransactionsRunIdRow {
  id?: string | number | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeError(error: unknown) {
  const err = toRecord(error);
  return {
    message: String(err.message || error || ''),
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

  const runData = (runRes.data || null) as BankTransactionsRunIdRow | null;
  const runId = String(runData?.id || '');
  if (!runId) return NextResponse.json({ error: 'Failed to start run' }, { status: 500 });

  try {
    const txs = await provider.fetchTransactions(range);

    const unique = new Map<string, (typeof txs)[number]>();
    for (const t of txs) {
      const id = String(t.providerTxId || '').trim();
      if (!id) continue;
      unique.set(id, t);
    }

    const rows = Array.from(unique.values()).map((transaction: BankTransaction) => ({
      provider: provider.id,
      provider_tx_id: String(transaction.providerTxId),
      booked_at: new Date(String(transaction.bookedAt)).toISOString(),
      amount: Number(transaction.amount),
      currency: String(transaction.currency || 'CZK'),
      account_iban: transaction.accountIban ? String(transaction.accountIban) : null,
      counterparty_iban: transaction.counterpartyIban ? String(transaction.counterpartyIban) : null,
      counterparty_name: transaction.counterpartyName ? String(transaction.counterpartyName) : null,
      vs: transaction.vs ? String(transaction.vs) : null,
      ks: transaction.ks ? String(transaction.ks) : null,
      ss: transaction.ss ? String(transaction.ss) : null,
      message: transaction.message ? String(transaction.message) : null,
      raw: toRecord(transaction.raw),
      updated_at: new Date().toISOString(),
    }));

    let upserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200);
      const up = await supabase.from('bank_transactions').upsert(batch, { onConflict: 'provider,provider_tx_id' });
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
  } catch (error: unknown) {
    const finishedAt = new Date();
    const info = normalizeError(error);
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
