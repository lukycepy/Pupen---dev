import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { getServerSupabase } from '@/lib/supabase-server';
import { writeAdminAudit } from '@/lib/admin-audit';
import { writeAuditLog } from '@/lib/audit/audit-log';
import { billingInvoiceTransitionSchema, type BillingInvoiceStatus } from '@/lib/validations/billing';
import { BILLING_INVOICE_PDF_BUCKET, buildBillingInvoicePdfBytes, buildBillingInvoicePdfStoragePath } from '@/lib/billing/invoice-pdf';
import { enqueueEmailTrigger } from '@/lib/email/triggers';
import { type BillingInvoiceItemRowLike, type BillingInvoiceRowLike } from '@/lib/billing/invoices';

const transitions: Record<BillingInvoiceStatus, BillingInvoiceStatus[]> = {
  draft: ['issued', 'cancelled'],
  issued: ['sent', 'partially_paid', 'paid', 'cancelled'],
  sent: ['partially_paid', 'paid', 'cancelled'],
  partially_paid: ['paid', 'cancelled'],
  paid: ['credited'],
  cancelled: [],
  credited: [],
};

interface BillingInvoiceSentEmailRow extends BillingInvoiceRowLike {
  buyer_email?: string | null;
  buyer_name?: string | null;
  number?: string | null;
  vs?: string | null;
  total?: number | string | null;
  currency?: string | null;
  due_date?: string | null;
  pdf_bucket?: string | null;
  pdf_path?: string | null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { invoiceId } = await ctx.params;
    const id = String(invoiceId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });

    const body = toRecord(await req.json().catch(() => ({})));
    const lang = body.lang === 'en' ? 'en' : 'cs';
    const parsed = billingInvoiceTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
    }

    const curr = await rls
      .from('billing_invoices')
      .select('id, status, type, number')
      .eq('id', id)
      .maybeSingle<BillingInvoiceRowLike>();
    if (curr.error) throw curr.error;
    if (!curr.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const fromStatus = String(curr.data.status || '') as BillingInvoiceStatus;
    const toStatus = parsed.data.toStatus;
    const allowed = transitions[fromStatus] || [];
    if (!allowed.includes(toStatus)) return NextResponse.json({ error: 'Invalid status transition' }, { status: 409 });

    if (toStatus === 'issued') {
      const srv = getServerSupabase();
      const issued = await srv.rpc('billing_issue_invoice', { p_invoice_id: id });
      if (issued.error) throw issued.error;
      const issuedInvoice = issued.data as BillingInvoiceRowLike | null;

      try {
        const itemsRes = await srv.from('billing_invoice_items').select('*').eq('invoice_id', id).order('position', { ascending: true });
        if (itemsRes.error) throw itemsRes.error;
        const items: BillingInvoiceItemRowLike[] = Array.isArray(itemsRes.data) ? itemsRes.data : [];

        const pdfBytes = await buildBillingInvoicePdfBytes({ invoice: issuedInvoice, items });
        const pdfPath = buildBillingInvoicePdfStoragePath(issuedInvoice);
        const upload = await srv.storage.from(BILLING_INVOICE_PDF_BUCKET).upload(pdfPath, pdfBytes, {
          upsert: true,
          contentType: 'application/pdf',
        });
        if (upload.error) throw upload.error;

        const upd = await srv
          .from('billing_invoices')
          .update({
            pdf_bucket: BILLING_INVOICE_PDF_BUCKET,
            pdf_path: pdfPath,
            pdf_generated_at: new Date().toISOString(),
            pdf_size_bytes: pdfBytes.length,
            pdf_mime: 'application/pdf',
          })
          .eq('id', id);
        if (upd.error) throw upd.error;

        await writeAdminAudit({
          adminEmail: user.email,
          adminName: 'Billing',
          action: 'BILLING_INVOICE_PDF_GENERATE',
          targetId: id,
          details: { id, bucket: BILLING_INVOICE_PDF_BUCKET, path: pdfPath, size: pdfBytes.length },
        });
      } catch (error: unknown) {
        await writeAdminAudit({
          adminEmail: user.email,
          adminName: 'Billing',
          action: 'BILLING_INVOICE_PDF_GENERATE_FAILED',
          targetId: id,
          details: { id, error: getErrorMessage(error) },
        });
      }

      await writeAdminAudit({
        adminEmail: user.email,
        adminName: 'Billing',
        action: 'BILLING_INVOICE_ISSUE',
        targetId: id,
        details: { id, number: issuedInvoice?.number ?? null },
      });

      const refreshed = await rls.from('billing_invoices').select('*').eq('id', id).maybeSingle<BillingInvoiceRowLike>();
      if (refreshed.error) throw refreshed.error;

      await writeAuditLog({
        req,
        actorUserId: user.id,
        actorEmail: user.email || null,
        action: 'billing_invoice.issue',
        entity: { type: 'billing_invoice', id },
        before: curr.data,
        after: refreshed.data || issuedInvoice,
      });

      return NextResponse.json({ invoice: refreshed.data || issuedInvoice });
    }

    const upd = await rls.from('billing_invoices').update({ status: toStatus }).eq('id', id).select('*').maybeSingle<BillingInvoiceRowLike>();
    if (upd.error) throw upd.error;
    if (!upd.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const action = toStatus === 'sent' ? 'billing_invoice.send' : toStatus === 'cancelled' ? 'billing_invoice.void' : 'billing_invoice.transition';
    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action,
      entity: { type: 'billing_invoice', id },
      before: curr.data,
      after: upd.data,
      details: { from: fromStatus, to: toStatus },
    });

    await writeAdminAudit({
      adminEmail: user.email,
      adminName: 'Billing',
      action: 'BILLING_INVOICE_TRANSITION',
      targetId: id,
      details: { id, from: fromStatus, to: toStatus },
    });

    if (toStatus === 'sent' && fromStatus !== 'sent') {
      const srv = getServerSupabase();
      const invRes = await srv
        .from('billing_invoices')
        .select('id, buyer_email, buyer_name, number, vs, total, currency, due_date, pdf_bucket, pdf_path')
        .eq('id', id)
        .maybeSingle<BillingInvoiceSentEmailRow>();
      if (invRes.error) throw invRes.error;
      const inv = invRes.data;

      const toEmail = String(inv?.buyer_email || '').trim();
      const pdfBucket = String(inv?.pdf_bucket || BILLING_INVOICE_PDF_BUCKET);
      const pdfPath = String(inv?.pdf_path || '').trim();
      let pdfUrl = '';
      if (pdfPath) {
        const signed = await srv.storage.from(pdfBucket).createSignedUrl(pdfPath, 7 * 24 * 60 * 60);
        if (!signed.error && signed.data?.signedUrl) pdfUrl = String(signed.data.signedUrl);
      }

      if (toEmail) {
        const enq = await enqueueEmailTrigger({
          triggerKey: 'billing_invoice_sent',
          toEmail,
          lang,
          vars: {
            toEmail,
            buyerName: inv?.buyer_name ? String(inv.buyer_name) : '',
            invoiceNumber: inv?.number ? String(inv.number) : '',
            vs: inv?.vs ? String(inv.vs) : '',
            total: inv?.total ?? null,
            currency: inv?.currency ? String(inv.currency) : 'CZK',
            dueDate: inv?.due_date ? String(inv.due_date) : '',
            pdfUrl,
          },
          headers: { 'X-Pupen-Category': 'billing', 'X-Pupen-Trigger': 'billing_invoice_sent', 'X-Pupen-Template': 'billing_invoice_sent' },
          meta: { invoice_id: id },
          supabase: srv,
        });

        await writeAdminAudit({
          adminEmail: user.email,
          adminName: 'Billing',
          action: 'EMAIL_ENQUEUE_BILLING_INVOICE_SENT',
          targetId: id,
          details: {
            id,
            to: toEmail,
            ok: enq.ok === true,
            queue_id: 'queueId' in enq ? enq.queueId || null : null,
            template_key: 'templateKey' in enq ? enq.templateKey || null : null,
          },
        });
      }
    }

    return NextResponse.json({ invoice: upd.data });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status =
      message === 'Unauthorized'
        ? 401
        : message === 'Forbidden'
          ? 403
          : message === 'Not found'
            ? 404
            : message === 'Invalid status transition'
              ? 409
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
