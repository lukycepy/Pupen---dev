import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { enqueueEmailTrigger } from '@/lib/email/triggers';
import { writeAuditLog } from '@/lib/audit/audit-log';
import { getMailerWithSettingsOrQueueTransporter, getSenderFromSettings } from '@/lib/email/mailer';
import { renderEmailTemplateWithDbOverride } from '@/lib/email/render';
import { sendMailWithQueueFallback } from '@/lib/email/queue';
import { stripHtmlToText } from '@/lib/richtext-shared';
import { getPaymentBankAccount, updateEventOrderStatus } from '@/lib/rsvp/orders';
import { buildEventCalendarAttachment } from '@/lib/tickets/calendarInvite';
import { ensureGuardianConsentPdf, getMinorAttendees } from '@/lib/rsvp/guardianConsent';
import { buildTicketPdfAttachment, buildTicketPdfUrl } from '@/lib/tickets/pdf';

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

interface EventOrderMatchRow {
  id?: string | null;
  event_id?: string | null;
  status?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  currency?: string | null;
  buyer_email?: string | null;
  buyer_name?: string | null;
  variable_symbol?: string | null;
  payment_method?: string | null;
  reservation_expires_at?: string | null;
}

interface EventOrderPaymentLinkRow {
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
  let skippedNoEventOrder = 0;
  let skippedMultipleEventOrders = 0;
  let eventOrderEmailsSent = 0;
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

      const eventOrderPaymentsRes = await supabase.from('event_order_payments').select('bank_transaction_id').in('bank_transaction_id', txIds);
      if (eventOrderPaymentsRes.error && !/event_order_payments/i.test(eventOrderPaymentsRes.error.message)) throw eventOrderPaymentsRes.error;
      for (const row of (Array.isArray(eventOrderPaymentsRes.data) ? eventOrderPaymentsRes.data : []) as EventOrderPaymentLinkRow[]) {
        const id = row.bank_transaction_id ? String(row.bank_transaction_id) : '';
        if (id) paired.add(id);
      }
    }

    const ticketTransporter = await getMailerWithSettingsOrQueueTransporter().catch(() => null);
    const ticketFrom = ticketTransporter ? await getSenderFromSettings().catch(() => null) : null;
    const bankAccount = await getPaymentBankAccount(supabase);

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

    for (const tx of txs) {
      const bankTransactionId = String(tx.id || '');
      if (!bankTransactionId || paired.has(bankTransactionId)) continue;

      const vs = String(tx.vs || '').trim();
      if (!vs) continue;

      const orderRes = await supabase
        .from('event_orders')
        .select('id, event_id, status, total_amount, paid_amount, currency, buyer_email, buyer_name, variable_symbol, payment_method, reservation_expires_at')
        .eq('variable_symbol', vs)
        .eq('payment_method', 'prevod')
        .in('status', ['reserved', 'confirmed'])
        .limit(2);

      if (orderRes.error) {
        if (/event_orders/i.test(orderRes.error.message) && /(schema cache|does not exist|relation)/i.test(orderRes.error.message)) {
          break;
        }
        throw orderRes.error;
      }

      const orders = (Array.isArray(orderRes.data) ? orderRes.data : []) as EventOrderMatchRow[];
      if (!orders.length) {
        skippedNoEventOrder += 1;
        continue;
      }
      if (orders.length > 1) {
        skippedMultipleEventOrders += 1;
        continue;
      }

      const order = orders[0];
      const orderId = String(order.id || '');
      if (!orderId) continue;

      const amount = Number(tx.amount || 0);
      const totalAmount = Number(order.total_amount || 0);
      if (Number.isFinite(totalAmount) && totalAmount > 0 && amount + 0.009 < totalAmount) {
        continue;
      }

      const paymentInsert = await supabase.from('event_order_payments').insert([
        {
          event_order_id: orderId,
          bank_transaction_id: bankTransactionId,
          amount: amount || 0,
          currency: String(tx.currency || order.currency || 'CZK'),
          paid_at: tx.booked_at || new Date().toISOString(),
          meta: { vs, provider: 'bank_matching' },
        },
      ]);
      if (paymentInsert.error) {
        if (/event_order_payments/i.test(paymentInsert.error.message) && /(schema cache|does not exist|relation)/i.test(paymentInsert.error.message)) {
          break;
        }
        errors.push({
          bankTransactionId,
          invoiceId: orderId,
          vs,
          error: normalizeError(paymentInsert.error),
        });
        continue;
      }

      await updateEventOrderStatus(supabase, orderId, {
        status: 'paid',
        paidAt: tx.booked_at || new Date().toISOString(),
        reservationExpiresAt: null,
        paidAmount: amount || totalAmount,
        matchedBankTransactionId: bankTransactionId,
      }).catch(() => {});

      const rsvpRes = await supabase
        .from('rsvp')
        .select('id, email, name, attendees, qr_token, qr_code, status, price_total, pricing_label, pricing_label_en, guardian_consent_document_bucket, guardian_consent_document_path')
        .eq('event_order_id', orderId)
        .order('created_at', { ascending: true });
      if (rsvpRes.error) throw rsvpRes.error;
      const linkedRsvps = Array.isArray(rsvpRes.data) ? rsvpRes.data : [];

      for (const rsvp of linkedRsvps) {
        await supabase
          .from('rsvp')
          .update({ status: 'confirmed', paid_at: tx.booked_at || new Date().toISOString(), expires_at: null, payment_due_at: null })
          .eq('id', String(rsvp.id || ''));
      }

      const eventTitleRes = await supabase.from('events').select('id, title, date, location, title_en').eq('id', String(order.event_id || '')).maybeSingle();
      const eventTitle = String(eventTitleRes.data?.title || '');

      const primaryRsvp = linkedRsvps[0];
      const toEmail = String(order.buyer_email || primaryRsvp?.email || '').trim();
      if (toEmail && ticketTransporter && ticketFrom && primaryRsvp) {
        try {
          const minors = getMinorAttendees(primaryRsvp.attendees, eventTitleRes.data?.date ? String((eventTitleRes.data as any).date) : null);
          const guardianConsent = await ensureGuardianConsentPdf({
            event: { ...(eventTitleRes.data as any), id: String(order.event_id || '') },
            rsvp: primaryRsvp as any,
            minors,
            lang: 'cs',
          });
          const calendarAttachment = await buildEventCalendarAttachment(String(order.event_id || ''), 'cs');
          const ticketPdfAttachment = await buildTicketPdfAttachment({
            event: { ...(eventTitleRes.data as any), id: String(order.event_id || '') },
            rsvp: {
              ...(primaryRsvp as any),
              status: 'confirmed',
              payment_method: String(order.payment_method || 'prevod'),
              variable_symbol: String(order.variable_symbol || vs),
            },
            lang: 'cs',
          });
          const { subject, html } = await renderEmailTemplateWithDbOverride('ticket', {
            email: toEmail,
            name: String(order.buyer_name || primaryRsvp.name || toEmail),
            eventTitle,
            attendees: Array.isArray(primaryRsvp.attendees) ? primaryRsvp.attendees : [],
            paymentMethod: String(order.payment_method || 'prevod'),
            qrToken: String(primaryRsvp.qr_code || primaryRsvp.qr_token || ''),
            status: 'confirmed',
            bankAccount,
            vs: String(order.variable_symbol || vs),
            priceTotal: Number(primaryRsvp.price_total || order.total_amount || 0),
            pricingLabel: String(primaryRsvp.pricing_label || ''),
            pricingLabelEn: String(primaryRsvp.pricing_label_en || ''),
            ticketPdfUrl: buildTicketPdfUrl(String(primaryRsvp.qr_code || primaryRsvp.qr_token || ''), 'cs'),
            guardianConsentUrl: guardianConsent.downloadUrl,
            guardianConsentUploadUrl: guardianConsent.uploadUrl,
            lang: 'cs',
          });
          await sendMailWithQueueFallback({
            transporter: ticketTransporter,
            supabase,
            meta: { kind: 'ticket_paid', eventOrderId: orderId, eventId: String(order.event_id || ''), email: toEmail },
            message: { from: ticketFrom, to: toEmail, subject, html, text: stripHtmlToText(html), attachments: [calendarAttachment, ticketPdfAttachment, guardianConsent.attachment].filter(Boolean) as any },
          });
          eventOrderEmailsSent += 1;
        } catch (error) {
          errors.push({
            bankTransactionId,
            invoiceId: orderId,
            vs,
            error: normalizeError(error),
          });
        }
      }

      await writeAuditLog({
        req,
        actorUserId: null,
        actorEmail: 'cron',
        action: 'event_order.match',
        entity: { type: 'event_order', id: orderId },
        before: order,
        after: { ...order, status: 'paid', paid_amount: amount || totalAmount, paid_at: tx.booked_at || new Date().toISOString() },
        details: {
          bank_transaction_id: bankTransactionId,
          vs,
          amount: tx.amount ?? null,
          currency: tx.currency ?? null,
          linked_rsvp_ids: linkedRsvps.map((item: any) => String(item.id || '')).filter(Boolean),
        },
      });

      paired.add(bankTransactionId);
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
      skippedNoEventOrder,
      skippedMultipleEventOrders,
      eventOrderEmailsSent,
      errors,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Error' }, { status: 500 });
  }
}
