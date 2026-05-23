import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { writeAdminAudit } from '@/lib/admin-audit';
import { toBillingInvoiceDto, toBillingInvoiceItemDto, toDbInvoiceJson, toDbItemsJson } from '@/lib/billing/invoices';

export async function POST(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  try {
    const { user } = await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = getRlsSupabase(token);

    const { invoiceId } = await ctx.params;
    const id = String(invoiceId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });

    const invRes = await supabase.from('billing_invoices').select('*').eq('id', id).maybeSingle();
    if (invRes.error) throw invRes.error;
    if (!invRes.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const itemsRes = await supabase.from('billing_invoice_items').select('*').eq('invoice_id', id).order('position', { ascending: true });
    if (itemsRes.error) throw itemsRes.error;
    const items = itemsRes.data || [];

    const srcNumber = String((invRes.data as any)?.number || '').trim();
    const notePrefix = srcNumber ? `Dobropis k ${srcNumber}` : `Dobropis k faktuře ${id}`;
    const nextNote = [notePrefix, String((invRes.data as any)?.note || '').trim()].filter(Boolean).join('\n');

    const createRes = await supabase.rpc('billing_invoice_create', {
      p_invoice: toDbInvoiceJson({
        type: 'credit_note',
        currency: (invRes.data as any).currency,
        buyerName: (invRes.data as any).buyer_name,
        buyerAddress: (invRes.data as any).buyer_address,
        buyerEmail: (invRes.data as any).buyer_email,
        ico: (invRes.data as any).ico,
        dic: (invRes.data as any).dic,
        note: nextNote,
        creditedInvoiceId: id,
      }),
      p_items: toDbItemsJson(
        items.map((it: any) => ({
          position: it.position,
          title: it.title,
          quantity: it.quantity,
          unitPrice: -Math.abs(Number(it.unit_price || 0)),
        })),
      ),
    });
    if (createRes.error) throw createRes.error;

    const upd = await supabase.from('billing_invoices').update({ status: 'credited' }).eq('id', id).select('*').maybeSingle();
    if (upd.error) throw upd.error;

    await writeAdminAudit({
      adminEmail: user.email,
      adminName: 'Billing',
      action: 'BILLING_INVOICE_CREDIT_NOTE',
      targetId: id,
      details: { id, credit_note_id: (createRes.data as any)?.id ?? null },
    });

    const cnItemsRes = await supabase
      .from('billing_invoice_items')
      .select('*')
      .eq('invoice_id', (createRes.data as any)?.id)
      .order('position', { ascending: true });
    if (cnItemsRes.error) throw cnItemsRes.error;

    return NextResponse.json({
      ok: true,
      creditedInvoice: upd.data ? toBillingInvoiceDto(upd.data) : toBillingInvoiceDto({ ...invRes.data, status: 'credited' }),
      creditNote: toBillingInvoiceDto(createRes.data),
      items: (cnItemsRes.data || []).map(toBillingInvoiceItemDto),
    });
  } catch (e: any) {
    const status =
      e?.message === 'Unauthorized'
        ? 401
        : e?.message === 'Forbidden'
          ? 403
          : e?.message === 'Not found'
            ? 404
            : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

