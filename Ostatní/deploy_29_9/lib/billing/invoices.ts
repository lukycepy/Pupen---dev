import { z } from 'zod';
import {
  billingInvoiceStatusSchema,
  billingInvoiceTypeSchema,
  type BillingInvoiceInput,
  type BillingInvoiceItemInput,
} from '@/lib/validations/billing';

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

export interface BillingInvoiceRowLike {
  id?: string | number | null;
  created_at?: string | null;
  updated_at?: string | null;
  number?: string | number | null;
  type?: string | null;
  status?: string | null;
  currency?: string | null;
  buyer_name?: string | null;
  buyer_address?: string | null;
  buyer_email?: string | null;
  ico?: string | null;
  dic?: string | null;
  vs?: string | null;
  note?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  total?: number | string | null;
  paid_amount?: number | string | null;
  paid_at?: string | null;
  source_deposit_invoice_id?: string | null;
  credited_invoice_id?: string | null;
  pdf_bucket?: string | null;
  pdf_path?: string | null;
  pdf_generated_at?: string | null;
  pdf_size_bytes?: number | string | null;
  pdf_mime?: string | null;
}

export interface BillingInvoiceItemRowLike {
  id?: string | number | null;
  invoice_id?: string | null;
  position?: number | string | null;
  title?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total?: number | string | null;
}

export interface BillingInvoiceWithItemsRowLike extends BillingInvoiceRowLike {
  billing_invoice_items?: BillingInvoiceItemRowLike[] | null;
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : Number(value || 0);
}

export function toBillingInvoiceDto(row: unknown): BillingInvoiceDto {
  const invoice = row as BillingInvoiceRowLike;
  const typeParsed = billingInvoiceTypeSchema.safeParse(String(invoice?.type || 'invoice'));
  const statusParsed = billingInvoiceStatusSchema.safeParse(String(invoice?.status || 'draft'));
  return {
    id: String(invoice?.id || ''),
    createdAt: String(invoice?.created_at || ''),
    updatedAt: String(invoice?.updated_at || ''),
    number: invoice?.number == null ? null : String(invoice.number),
    type: typeParsed.success ? typeParsed.data : 'invoice',
    status: statusParsed.success ? statusParsed.data : 'draft',
    currency: String(invoice?.currency || 'CZK'),
    buyerName: invoice?.buyer_name == null ? null : String(invoice.buyer_name),
    buyerAddress: invoice?.buyer_address == null ? null : String(invoice.buyer_address),
    buyerEmail: invoice?.buyer_email == null ? null : String(invoice.buyer_email),
    ico: invoice?.ico == null ? null : String(invoice.ico),
    dic: invoice?.dic == null ? null : String(invoice.dic),
    vs: invoice?.vs == null ? null : String(invoice.vs),
    note: invoice?.note == null ? null : String(invoice.note),
    issueDate: invoice?.issue_date == null ? null : String(invoice.issue_date),
    dueDate: invoice?.due_date == null ? null : String(invoice.due_date),
    total: toNumber(invoice?.total),
    paidAmount: toNumber(invoice?.paid_amount),
    paidAt: invoice?.paid_at == null ? null : String(invoice.paid_at),
    sourceDepositInvoiceId: invoice?.source_deposit_invoice_id == null ? null : String(invoice.source_deposit_invoice_id),
    creditedInvoiceId: invoice?.credited_invoice_id == null ? null : String(invoice.credited_invoice_id),
    pdfBucket: invoice?.pdf_bucket == null ? null : String(invoice.pdf_bucket),
    pdfPath: invoice?.pdf_path == null ? null : String(invoice.pdf_path),
    pdfGeneratedAt: invoice?.pdf_generated_at == null ? null : String(invoice.pdf_generated_at),
    pdfSizeBytes: invoice?.pdf_size_bytes == null ? null : toNumber(invoice.pdf_size_bytes),
    pdfMime: invoice?.pdf_mime == null ? null : String(invoice.pdf_mime),
  };
}

export function toBillingInvoiceItemDto(row: unknown): BillingInvoiceItemDto {
  const item = row as BillingInvoiceItemRowLike;
  return {
    id: String(item?.id || ''),
    invoiceId: String(item?.invoice_id || ''),
    position: toNumber(item?.position),
    title: String(item?.title || ''),
    quantity: toNumber(item?.quantity),
    unitPrice: toNumber(item?.unit_price),
    total: toNumber(item?.total),
  };
}

export function toDbInvoiceJson(invoice: BillingInvoiceInput) {
  return {
    type: invoice.type,
    currency: invoice.currency,
    buyer_name: invoice.buyerName,
    buyer_address: invoice.buyerAddress,
    buyer_email: invoice.buyerEmail,
    ico: invoice.ico,
    dic: invoice.dic,
    vs: invoice.vs,
    note: invoice.note,
    issue_date: invoice.issueDate,
    due_date: invoice.dueDate,
    source_deposit_invoice_id: invoice.sourceDepositInvoiceId,
    credited_invoice_id: invoice.creditedInvoiceId,
  };
}

export function toDbItemsJson(items: BillingInvoiceItemInput[]) {
  return (Array.isArray(items) ? items : []).map((item, idx: number) => ({
    position: item.position == null ? idx + 1 : item.position,
    title: item.title,
    quantity: item.quantity,
    unit_price: item.unitPrice,
  }));
}
