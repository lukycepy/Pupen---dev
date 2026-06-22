import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { writeAdminAudit } from '@/lib/admin-audit';
import {
  toBillingInvoiceDto,
  toBillingInvoiceItemDto,
  toDbInvoiceJson,
  toDbItemsJson,
  type BillingInvoiceItemRowLike,
  type BillingInvoiceRowLike,
} from '@/lib/billing/invoices';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function POST(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getRlsSupabase(token);

    const { invoiceId } = await ctx.params;
    const id = String(invoiceId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });

    const invRes = await supabase.from('billing_invoices').select('*').eq('id', id).maybeSingle<BillingInvoiceRowLike>();
    if (invRes.error) throw invRes.error;
    if (!invRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const itemsRes = await supabase.from('billing_invoice_items').select('*').eq('invoice_id', id).order('position', { ascending: true });
    if (itemsRes.error) throw itemsRes.error;
    const items: BillingInvoiceItemRowLike[] = Array.isArray(itemsRes.data) ? itemsRes.data : [];

    const srcNumber = String(invRes.data.number || '').trim();
    const notePrefix = srcNumber ? `Dobropis k ${srcNumber}` : `Dobropis k faktuře ${id}`;
    const nextNote = [notePrefix, String(invRes.data.note || '').trim()].filter(Boolean).join('\n');

    const createRes = await supabase.rpc('billing_invoice_create', {
      p_invoice: toDbInvoiceJson({
        type: 'credit_note',
        currency: invRes.data.currency || undefined,
        buyerName: invRes.data.buyer_name || undefined,
        buyerAddress: invRes.data.buyer_address || undefined,
        buyerEmail: invRes.data.buyer_email || undefined,
        ico: invRes.data.ico || undefined,
        dic: invRes.data.dic || undefined,
        note: nextNote,
        creditedInvoiceId: id,
      }),
      p_items: toDbItemsJson(
        items.map((it) => ({
          position: it.position,
          title: it.title,
          quantity: it.quantity,
          unitPrice: -Math.abs(Number(it.unit_price || 0)),
        })),
      ),
    });
    if (createRes.error) throw createRes.error;
    const creditNoteInvoice = createRes.data as BillingInvoiceRowLike | null;

    const upd = await supabase.from('billing_invoices').update({ status: 'credited' }).eq('id', id).select('*').maybeSingle<BillingInvoiceRowLike>();
    if (upd.error) throw upd.error;

    await writeAdminAudit({
      adminEmail: user.email,
      adminName: 'Billing',
      action: 'BILLING_INVOICE_CREDIT_NOTE',
      targetId: id,
      details: { id, credit_note_id: creditNoteInvoice?.id ?? null },
    });

    const cnItemsRes = await supabase
      .from('billing_invoice_items')
      .select('*')
      .eq('invoice_id', creditNoteInvoice?.id || '')
      .order('position', { ascending: true });
    if (cnItemsRes.error) throw cnItemsRes.error;
    const creditNoteItems: BillingInvoiceItemRowLike[] = Array.isArray(cnItemsRes.data) ? cnItemsRes.data : [];

    return NextResponse.json({
      ok: true,
      creditedInvoice: upd.data ? toBillingInvoiceDto(upd.data) : toBillingInvoiceDto({ ...invRes.data, status: 'credited' }),
      creditNote: toBillingInvoiceDto(creditNoteInvoice),
      items: creditNoteItems.map(toBillingInvoiceItemDto),
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status =
      message === 'Unauthorized'
        ? 401
        : message === 'Forbidden'
          ? 403
          : message === 'Not found'
            ? 404
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
