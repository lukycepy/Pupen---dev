import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { enqueueEmailTrigger } from '@/lib/email/triggers';
import { writeAuditLog } from '@/lib/audit/audit-log';

export const runtime = 'nodejs';

interface BankTransactionMatchRow {
  id?: string | null;
  vs?: string | null;
  amount?: number | null;
  currency?: string | null;
  booked_at?: string | null;
}

interface BillingInvoiceMatchRow {
  id?: string | null;
  status?: string | null;
  total?: number | null;
  paid_amount?: number | null;
  currency?: string | null;
  buyer_email?: string | null;
  buyer_name?: string | null;
  number?: string | null;
  vs?: string | null;
}

interface BillingInvoicePaymentLinkRow {
  bank_transaction_id?: string | null;
}

interface MatchErrorPayload {
  bankTransactionId: string;
  invoiceId?: string;
  vs: string;
  error: ReturnType<typeof normalizeError>;
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

function getEnqueueFailure(result: unknown) {
  const record = toRecord(result);
  return record.error || record.skipped || 'enqueue_failed';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get('secret') || '';
  const expected = process.env.CRON_SECRET || '';
  if (!expected || secret !== expected) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 200)));
  const dryRun = String(url.searchParams.get('dryRun') || '') === 'true';

  const supabase = getServerSupabase();

  let processed = 0;
  let matched = 0;
  let emailsEnqueued = 0;
  let skippedAlreadyPaired = 0;
  let skippedNoVs = 0;
  let skippedNoInvoice = 0;
  let skippedMultipleInvoices = 0;
  const errors: MatchErrorPayload[] = [];

  try {
    const txRes = await supabase
      .from('bank_transactions')
      .select('id, vs, amount, currency, booked_at')
      .not('vs', 'is', null)
      .gt('amount', 0)
      .order('booked_at', { ascending: false })
      .limit(limit);
    if (txRes.error) throw txRes.error;

    const txs = (Array.isArray(txRes.data) ? txRes.data : []) as BankTransactionMatchRow[];
    const txIds = txs.map((transaction) => String(transaction.id || '')).filter(Boolean);
    const paired = new Set<string>();

    if (txIds.length) {
      const payRes = await supabase.from('billing_invoice_payments').select('bank_transaction_id').in('bank_transaction_id', txIds);
      if (payRes.error) throw payRes.error;
      for (const row of (Array.isArray(payRes.data) ? payRes.data : []) as BillingInvoicePaymentLinkRow[]) {
        const id = row.bank_transaction_id ? String(row.bank_transaction_id) : '';
        if (id) paired.add(id);
      }
    }

    for (const tx of txs) {
      processed += 1;
      const bankTransactionId = String(tx.id || '');
      if (!bankTransactionId) continue;
      if (paired.has(bankTransactionId)) {
        skippedAlreadyPaired += 1;
        continue;
      }

      const vs = String(tx.vs || '').trim();
      if (!vs) {
        skippedNoVs += 1;
        continue;
      }

      const invRes = await supabase
        .from('billing_invoices')
        .select('id, status, total, paid_amount, currency, buyer_email, buyer_name, number, vs')
        .eq('vs', vs)
        .in('status', ['issued', 'sent', 'partially_paid'])
        .limit(2);
      if (invRes.error) throw invRes.error;
      const candidates = (Array.isArray(invRes.data) ? invRes.data : []) as BillingInvoiceMatchRow[];

      if (!candidates.length) {
        skippedNoInvoice += 1;
        continue;
      }
      if (candidates.length > 1) {
        skippedMultipleInvoices += 1;
        continue;
      }

      const invoice = candidates[0];
      const invoiceId = String(invoice.id || '');
      if (!invoiceId) continue;
      const beforeStatus = String(invoice.status || '');

      if (dryRun) {
        matched += 1;
        continue;
      }

      const pair = await supabase.rpc('pair_bank_transaction_to_billing_invoice', {
        p_bank_transaction_id: bankTransactionId,
        p_invoice_id: invoiceId,
        p_amount: null,
      });

      if (pair.error) {
        errors.push({
          bankTransactionId,
          invoiceId,
          vs,
          error: normalizeError(pair.error),
        });
        continue;
      }

      const paymentId = pair.data ? String(pair.data) : null;

      const afterRes = await supabase
        .from('billing_invoices')
        .select('id, status, total, paid_amount, currency, buyer_email, buyer_name, number, vs')
        .eq('id', invoiceId)
        .maybeSingle();
      if (afterRes.error) throw afterRes.error;
      const after = ((afterRes.data || invoice) as BillingInvoiceMatchRow);
      const afterStatus = String(after.status || beforeStatus);

      await writeAuditLog({
        req,
        actorUserId: null,
        actorEmail: 'cron',
        action: 'billing_invoice.match',
        entity: { type: 'billing_invoice', id: invoiceId },
        before: invoice,
        after,
        details: {
          before_status: beforeStatus,
          after_status: afterStatus,
          bank_transaction_id: bankTransactionId,
          payment_id: paymentId,
          vs,
          amount: tx.amount ?? null,
          currency: tx.currency ?? null,
        },
      });

      if (afterStatus === 'paid' && beforeStatus !== 'paid') {
        const toEmail = String(after.buyer_email || '').trim();
        if (toEmail) {
          const enq = await enqueueEmailTrigger({
            triggerKey: 'billing_invoice_paid',
            toEmail,
            lang: 'cs',
            vars: {
              toEmail,
              buyerName: after.buyer_name ? String(after.buyer_name) : '',
              invoiceNumber: after.number ? String(after.number) : '',
              vs: after.vs ? String(after.vs) : '',
              total: after.total ?? null,
              currency: after.currency ? String(after.currency) : 'CZK',
            },
            meta: { invoice_id: invoiceId, bank_transaction_id: bankTransactionId },
            headers: { 'X-Pupen-Category': 'billing', 'X-Pupen-Trigger': 'billing_invoice_paid' },
            supabase,
          });

          if (enq.ok) {
            emailsEnqueued += 1;
            await writeAuditLog({
              req,
              actorUserId: null,
              actorEmail: 'cron',
              action: 'billing_invoice.email_enqueued_paid',
              entity: { type: 'billing_invoice', id: invoiceId },
              before: null,
              after: null,
              details: { bank_transaction_id: bankTransactionId, to: toEmail },
            });
          } else {
            errors.push({
              bankTransactionId,
              invoiceId,
              vs,
              error: normalizeError(getEnqueueFailure(enq)),
            });
          }
        }
      }

      matched += 1;
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      processed,
      matched,
      emailsEnqueued,
      skippedAlreadyPaired,
      skippedNoVs,
      skippedNoInvoice,
      skippedMultipleInvoices,
      errors,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}
