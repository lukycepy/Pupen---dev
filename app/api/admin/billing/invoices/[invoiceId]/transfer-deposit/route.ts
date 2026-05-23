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
    if (String((invRes.data as any).type) !== 'deposit') return NextResponse.json({ error: 'Not a deposit invoice' }, { status: 400 });

    const srcNumber = String((invRes.data as any).number || '').trim();
    const title = srcNumber ? `Převod zálohy ${srcNumber}` : `Převod zálohy ${id}`;
    const amount = Math.abs(Number((invRes.data as any).total || 0));

    const createRes = await supabase.rpc('billing_invoice_create', {
      p_invoice: toDbInvoiceJson({
        type: 'invoice',
        currency: (invRes.data as any).currency,
        buyerName: (invRes.data as any).buyer_name,
        buyerAddress: (invRes.data as any).buyer_address,
        buyerEmail: (invRes.data as any).buyer_email,
        ico: (invRes.data as any).ico,
        dic: (invRes.data as any).dic,
        vs: (invRes.data as any).vs,
        note: (invRes.data as any).note,
        sourceDepositInvoiceId: id,
      }),
      p_items: toDbItemsJson([{ position: 1, title, quantity: 1, unitPrice: -amount }]),
    });
    if (createRes.error) throw createRes.error;

    const upd = await supabase.from('billing_invoices').update({ status: 'credited' }).eq('id', id).select('*').maybeSingle();
    if (upd.error) throw upd.error;

    await writeAdminAudit({
      adminEmail: user.email,
      adminName: 'Billing',
      action: 'BILLING_DEPOSIT_TRANSFER',
      targetId: id,
      details: { id, invoice_id: (createRes.data as any)?.id ?? null },
    });

    const itemsRes = await supabase
      .from('billing_invoice_items')
      .select('*')
      .eq('invoice_id', (createRes.data as any)?.id)
      .order('position', { ascending: true });
    if (itemsRes.error) throw itemsRes.error;

    return NextResponse.json({
      ok: true,
      depositInvoice: upd.data ? toBillingInvoiceDto(upd.data) : toBillingInvoiceDto({ ...invRes.data, status: 'credited' }),
      invoice: toBillingInvoiceDto(createRes.data),
      items: (itemsRes.data || []).map(toBillingInvoiceItemDto),
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
