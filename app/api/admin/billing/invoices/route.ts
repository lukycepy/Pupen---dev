import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import { getServerSupabase } from '@/lib/supabase-server';
import { billingInvoiceCreateSchema, billingInvoiceStatusSchema, billingInvoiceTypeSchema } from '@/lib/validations/billing';
import { toBillingInvoiceDto, toDbInvoiceJson, toDbItemsJson } from '@/lib/billing/invoices';
import { writeAuditLog } from '@/lib/audit/audit-log';

function asDayStartIso(d: string) {
  const s = String(d || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function asDayEndIso(d: string) {
  const s = String(d || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T23:59:59.999Z`;
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 200);
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
    const q = String(url.searchParams.get('q') || '').trim();

    const rawStatus = String(url.searchParams.get('status') || '').trim();
    const rawType = String(url.searchParams.get('type') || '').trim();
    const createdFrom = asDayStartIso(String(url.searchParams.get('from') || ''));
    const createdTo = asDayEndIso(String(url.searchParams.get('to') || ''));

    const status = rawStatus ? billingInvoiceStatusSchema.safeParse(rawStatus).data : undefined;
    const type = rawType ? billingInvoiceTypeSchema.safeParse(rawType).data : undefined;

    const supabase = getServerSupabase();
    let query = supabase.from('billing_invoices').select('*', { count: 'exact' });
    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);
    if (createdFrom) query = query.gte('created_at', createdFrom);
    if (createdTo) query = query.lte('created_at', createdTo);
    if (q) {
      const qq = q.replaceAll(',', ' ').trim();
      query = query.or(`number.ilike.%${qq}%,buyer_name.ilike.%${qq}%,buyer_email.ilike.%${qq}%,vs.ilike.%${qq}%`);
    }

    const res = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
    if (res.error) throw res.error;

    return NextResponse.json({
      ok: true,
      rows: (res.data || []).map(toBillingInvoiceDto),
      count: typeof res.count === 'number' ? res.count : null,
    });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    const body = await req.json().catch(() => ({}));
    const parsed = billingInvoiceCreateSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const supabase = getServerSupabase();
    const invRes = await supabase.rpc('billing_invoice_create', {
      p_invoice: toDbInvoiceJson(parsed.data.invoice),
      p_items: toDbItemsJson(parsed.data.items),
    });
    if (invRes.error) throw invRes.error;

    await supabase
      .from('admin_logs')
      .insert([
        {
          admin_email: user.email || 'admin',
          admin_name: user.user_metadata?.full_name || user.email || 'admin',
          action: 'BILLING_INVOICE_CREATE',
          target_id: invRes.data?.id || null,
          details: { type: parsed.data.invoice?.type || 'invoice' },
        },
      ])
      .throwOnError();

    await writeAuditLog({
      req,
      actorUserId: user.id,
      actorEmail: user.email || null,
      action: 'billing_invoice.create',
      entity: { type: 'billing_invoice', id: invRes.data?.id || null },
      before: null,
      after: invRes.data,
      details: { type: parsed.data.invoice?.type || 'invoice' },
    });

    return NextResponse.json({ ok: true, invoice: toBillingInvoiceDto(invRes.data) });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}
