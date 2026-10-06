import { z } from 'zod';

export const billingInvoiceTypeSchema = z.enum(['invoice', 'deposit', 'credit_note']);
export type BillingInvoiceType = z.infer<typeof billingInvoiceTypeSchema>;

export const billingInvoiceStatusSchema = z.enum(['draft', 'issued', 'sent', 'partially_paid', 'paid', 'cancelled', 'credited']);
export type BillingInvoiceStatus = z.infer<typeof billingInvoiceStatusSchema>;

export const billingInvoiceItemInputSchema = z.object({
  position: z.coerce.number().int().positive().optional(),
  title: z.string().min(1).max(300),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
});
export type BillingInvoiceItemInput = z.infer<typeof billingInvoiceItemInputSchema>;

export const billingInvoiceInputSchema = z.object({
  type: billingInvoiceTypeSchema.optional(),
  currency: z.string().min(1).max(10).optional(),
  buyerName: z.string().max(300).optional(),
  buyerAddress: z.string().max(2000).optional(),
  buyerEmail: z.string().email().max(200).optional(),
  ico: z.string().max(30).optional(),
  dic: z.string().max(30).optional(),
  vs: z.string().max(30).optional(),
  note: z.string().max(4000).optional(),
  issueDate: z.string().date().optional(),
  dueDate: z.string().date().optional(),
  sourceDepositInvoiceId: z.string().uuid().optional(),
  creditedInvoiceId: z.string().uuid().optional(),
});
export type BillingInvoiceInput = z.infer<typeof billingInvoiceInputSchema>;

export const billingInvoiceCreateSchema = z.object({
  invoice: billingInvoiceInputSchema,
  items: z.array(billingInvoiceItemInputSchema).min(1),
});

export const billingInvoiceUpdateSchema = billingInvoiceCreateSchema;

export const billingInvoiceTransitionSchema = z.object({
  toStatus: billingInvoiceStatusSchema,
});
