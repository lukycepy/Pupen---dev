import { z } from 'zod';
import { billingInvoiceStatusSchema, billingInvoiceTypeSchema } from '@/lib/validations/billing';

export const billingInvoiceDtoSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  number: z.string().nullable(),
  type: billingInvoiceTypeSchema,
  status: billingInvoiceStatusSchema,
  currency: z.string(),
  buyerName: z.string().nullable(),
  buyerAddress: z.string().nullable(),
  buyerEmail: z.string().nullable(),
  ico: z.string().nullable(),
  dic: z.string().nullable(),
  vs: z.string().nullable(),
  note: z.string().nullable(),
  issueDate: z.string().nullable(),
  dueDate: z.string().nullable(),
  total: z.number(),
  paidAmount: z.number(),
  paidAt: z.string().nullable(),
  sourceDepositInvoiceId: z.string().uuid().nullable(),
  creditedInvoiceId: z.string().uuid().nullable(),
  pdfBucket: z.string().nullable(),
  pdfPath: z.string().nullable(),
  pdfGeneratedAt: z.string().nullable(),
  pdfSizeBytes: z.number().nullable(),
  pdfMime: z.string().nullable(),
});

export type BillingInvoiceDto = z.infer<typeof billingInvoiceDtoSchema>;

export const billingInvoiceItemDtoSchema = z.object({
  id: z.string().uuid(),
  invoiceId: z.string().uuid(),
  position: z.number().int(),
  title: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  total: z.number(),
});

export type BillingInvoiceItemDto = z.infer<typeof billingInvoiceItemDtoSchema>;

export function toBillingInvoiceDto(row: any): BillingInvoiceDto {
  return {
    id: String(row?.id || ''),
    createdAt: String(row?.created_at || ''),
    updatedAt: String(row?.updated_at || ''),
    number: row?.number == null ? null : String(row.number),
    type: String(row?.type || 'invoice') as any,
    status: String(row?.status || 'draft') as any,
    currency: String(row?.currency || 'CZK'),
    buyerName: row?.buyer_name == null ? null : String(row.buyer_name),
    buyerAddress: row?.buyer_address == null ? null : String(row.buyer_address),
    buyerEmail: row?.buyer_email == null ? null : String(row.buyer_email),
    ico: row?.ico == null ? null : String(row.ico),
    dic: row?.dic == null ? null : String(row.dic),
    vs: row?.vs == null ? null : String(row.vs),
    note: row?.note == null ? null : String(row.note),
    issueDate: row?.issue_date == null ? null : String(row.issue_date),
    dueDate: row?.due_date == null ? null : String(row.due_date),
    total: typeof row?.total === 'number' ? row.total : Number(row?.total || 0),
    paidAmount: typeof row?.paid_amount === 'number' ? row.paid_amount : Number(row?.paid_amount || 0),
    paidAt: row?.paid_at == null ? null : String(row.paid_at),
    sourceDepositInvoiceId: row?.source_deposit_invoice_id == null ? null : String(row.source_deposit_invoice_id),
    creditedInvoiceId: row?.credited_invoice_id == null ? null : String(row.credited_invoice_id),
    pdfBucket: row?.pdf_bucket == null ? null : String(row.pdf_bucket),
    pdfPath: row?.pdf_path == null ? null : String(row.pdf_path),
    pdfGeneratedAt: row?.pdf_generated_at == null ? null : String(row.pdf_generated_at),
    pdfSizeBytes: row?.pdf_size_bytes == null ? null : Number(row.pdf_size_bytes || 0),
    pdfMime: row?.pdf_mime == null ? null : String(row.pdf_mime),
  };
}

export function toBillingInvoiceItemDto(row: any): BillingInvoiceItemDto {
  return {
    id: String(row?.id || ''),
    invoiceId: String(row?.invoice_id || ''),
    position: typeof row?.position === 'number' ? row.position : Number(row?.position || 0),
    title: String(row?.title || ''),
    quantity: typeof row?.quantity === 'number' ? row.quantity : Number(row?.quantity || 0),
    unitPrice: typeof row?.unit_price === 'number' ? row.unit_price : Number(row?.unit_price || 0),
    total: typeof row?.total === 'number' ? row.total : Number(row?.total || 0),
  };
}

export function toDbInvoiceJson(invoice: any) {
  return {
    type: invoice?.type,
    currency: invoice?.currency,
    buyer_name: invoice?.buyerName,
    buyer_address: invoice?.buyerAddress,
    buyer_email: invoice?.buyerEmail,
    ico: invoice?.ico,
    dic: invoice?.dic,
    vs: invoice?.vs,
    note: invoice?.note,
    issue_date: invoice?.issueDate,
    due_date: invoice?.dueDate,
    source_deposit_invoice_id: invoice?.sourceDepositInvoiceId,
    credited_invoice_id: invoice?.creditedInvoiceId,
  };
}

export function toDbItemsJson(items: any[]) {
  return (Array.isArray(items) ? items : []).map((it: any, idx: number) => ({
    position: it?.position == null ? idx + 1 : it.position,
    title: it?.title,
    quantity: it?.quantity,
    unit_price: it?.unitPrice,
  }));
}
