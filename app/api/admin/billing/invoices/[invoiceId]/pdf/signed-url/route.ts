import { NextResponse } from 'next/server';
import { getBearerToken, requireAdmin } from '@/lib/server-auth';
import { getRlsSupabase } from '@/lib/supabase-rls';
import { getServerSupabase } from '@/lib/supabase-server';
import { BILLING_INVOICE_PDF_BUCKET } from '@/lib/billing/invoice-pdf';

export async function POST(req: Request, ctx: { params: Promise<{ invoiceId: string }> }) {
  try {
    await requireAdmin(req);
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rls = getRlsSupabase(token);

    const { invoiceId } = await ctx.params;
    const id = String(invoiceId || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const expiresIn = Math.max(60, Math.min(60 * 60, Number(body?.expiresIn || 600) || 600));

    const inv = await rls.from('billing_invoices').select('pdf_bucket, pdf_path').eq('id', id).maybeSingle();
    if (inv.error) throw inv.error;
    if (!inv.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const bucket = String((inv.data as any)?.pdf_bucket || BILLING_INVOICE_PDF_BUCKET);
    const path = String((inv.data as any)?.pdf_path || '').trim();
    if (!path) return NextResponse.json({ error: 'Missing PDF' }, { status: 409 });

    const srv = getServerSupabase();
    const signed = await srv.storage.from(bucket).createSignedUrl(path, expiresIn);
    if (signed.error) throw signed.error;

    return NextResponse.json({ ok: true, signedUrl: signed.data?.signedUrl || null, expiresIn });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

