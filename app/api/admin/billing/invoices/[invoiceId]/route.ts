import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { writeAdminAudit } from '@/lib/admin-audit';
import { writeAuditLog } from '@/lib/audit/audit-log';
import { billingInvoiceUpdateSchema, billingInvoiceTypeSchema } from '@/lib/validations/billing';
import {
  toBillingInvoiceDto,
  toBillingInvoiceItemDto,
  type BillingInvoiceItemRowLike,
  type BillingInvoiceRowLike,
  type BillingInvoiceWithItemsRowLike,
} from '@/lib/billing/invoices';

function sumItems(items: Array<{ quantity: number; unitPrice: number }>) {
  return items.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(_req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  try {
    await requireAdmin(_req);
    const token = getBearerToken(_req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getRlsSupabase(token);

    const { invoiceId } = await ctx.params;
    const id = String(invoiceId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });

    const inv = await supabase
      .from('billing_invoices')
      .select('*, billing_invoice_items(*)')
      .eq('id', id)
      .maybeSingle<BillingInvoiceWithItemsRowLike>();
    if (inv.error) throw inv.error;
    if (!inv.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const items: BillingInvoiceItemRowLike[] = Array.isArray(inv.data.billing_invoice_items) ? inv.data.billing_invoice_items : [];
    return NextResponse.json({
      ok: true,
      invoice: toBillingInvoiceDto(inv.data),
      items: items.map(toBillingInvoiceItemDto),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function updateInvoice(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getRlsSupabase(token);

    const { invoiceId } = await ctx.params;
    const id = String(invoiceId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });

    const body = await req.json().catch(() => null);
    const parsed = billingInvoiceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
    }

    const invoice = parsed.data.invoice;
    const items = parsed.data.items;
    const invType = billingInvoiceTypeSchema.parse(invoice.type || 'invoice');

    const beforeRes = await supabase
      .from('billing_invoices')
      .select('*, billing_invoice_items(*)')
      .eq('id', id)
      .maybeSingle<BillingInvoiceWithItemsRowLike>();
    if (beforeRes.error) throw beforeRes.error;

    const total = sumItems(items);
    if (invType === 'credit_note') {
      if (!invoice.creditedInvoiceId) return NextResponse.json({ error: 'Missing creditedInvoiceId' }, { status: 400 });
      if (total > 0) return NextResponse.json({ error: 'Credit note must have non-positive total' }, { status: 400 });
    }

    const rpcInvoice = {
      type: invType,
      currency: invoice.currency || 'CZK',
      buyer_name: invoice.buyerName || null,
      buyer_address: invoice.buyerAddress || null,
      buyer_email: invoice.buyerEmail || null,
      ico: invoice.ico || null,
      dic: invoice.dic || null,
      vs: invoice.vs || null,
      note: invoice.note || null,
      issue_date: invoice.issueDate || null,
      due_date: invoice.dueDate || null,
      source_deposit_invoice_id: invoice.sourceDepositInvoiceId || null,
      credited_invoice_id: invoice.creditedInvoiceId || null,
    };

    const rpcItems = items.map((it) => ({
      position: it.position,
      title: it.title,
      quantity: it.quantity,
      unit_price: it.unitPrice,
    }));

    const updated = await supabase.rpc('billing_invoice_update', { p_invoice_id: id, p_invoice: rpcInvoice, p_items: rpcItems });
    if (updated.error) throw updated.error;
    const row = updated.data as BillingInvoiceRowLike | null;

    await writeAdminAudit({
      adminEmail: user.email,
      adminName: 'Billing',
      action: 'BILLING_INVOICE_UPDATE',
      targetId: id,
      details: { id, type: invType, currency: rpcInvoice.currency, total: row?.total ?? null },
    });

    const itemsRes = await supabase
      .from('billing_invoice_items')
      .select('*')
      .eq('invoice_id', id)
      .order('position', { ascending: true });
    if (itemsRes.error) throw itemsRes.error;
    const updatedItems: BillingInvoiceItemRowLike[] = Array.isArray(itemsRes.data) ? itemsRes.data : [];

    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'billing_invoice.update',
      entity: { type: 'billing_invoice', id },
      before: beforeRes.data,
      after: { ...(row || {}), billing_invoice_items: updatedItems },
    });

    return NextResponse.json({ ok: true, invoice: toBillingInvoiceDto(row), items: updatedItems.map(toBillingInvoiceItemDto) });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status =
      message === 'Unauthorized'
        ? 401
        : message === 'Forbidden'
          ? 403
          : message === 'Not found'
            ? 404
            : message === 'Invoice is not editable'
              ? 409
              : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  return updateInvoice(req, ctx);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  return updateInvoice(req, ctx);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getRlsSupabase(token);

    const { invoiceId } = await ctx.params;
    const id = String(invoiceId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });

    const inv = await supabase.from('billing_invoices').select('id, status').eq('id', id).maybeSingle<BillingInvoiceRowLike>();
    if (inv.error) throw inv.error;
    if (!inv.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (String(inv.data.status) !== 'draft') return NextResponse.json({ error: 'Only draft invoices can be deleted' }, { status: 409 });

    const del = await supabase.from('billing_invoices').delete().eq('id', id);
    if (del.error) throw del.error;

    await writeAdminAudit({
      adminEmail: user.email,
      adminName: 'Billing',
      action: 'BILLING_INVOICE_DELETE',
      targetId: id,
      details: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
