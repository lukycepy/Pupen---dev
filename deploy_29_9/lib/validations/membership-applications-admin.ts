import { z } from 'zod';

export const membershipApplicationStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type MembershipApplicationStatus = z.infer<typeof membershipApplicationStatusSchema>;

export const membershipApplicationMembershipTypeSchema = z.enum(['regular', 'external']);
export type MembershipApplicationMembershipType = z.infer<typeof membershipApplicationMembershipTypeSchema>;

export const membershipApplicationChairAuthKindSchema = z.enum(['signature', 'stamp']);
export type MembershipApplicationChairAuthKind = z.infer<typeof membershipApplicationChairAuthKindSchema>;

export const membershipApplicationAdminListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().optional().default(''),
  status: membershipApplicationStatusSchema.optional(),
  pendingCount: z
    .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
    .optional()
    .default('0'),
});

export const membershipApplicationPdfSnapshotSchema = z
  .object({
    cs: z.unknown().optional(),
    en: z.unknown().optional(),
  })
  .optional();

export const membershipApplicationMetaPatchSchema = z
  .object({
    lang: z.enum(['cs', 'en']).optional(),
    membership_type: membershipApplicationMembershipTypeSchema.optional(),
    first_name: z.string().max(80).optional(),
    last_name: z.string().max(80).optional(),
    university_email: z.string().max(200).nullable().optional(),
    field_of_study: z.string().max(200).nullable().optional(),
    study_year: z.string().max(80).nullable().optional(),
    signed_on: z.string().max(80).nullable().optional(),
    gdpr_consent: z.boolean().optional(),
    address_meta: z.unknown().optional(),
    pdf_snapshot: membershipApplicationPdfSnapshotSchema,
  })
  .passthrough()
  .optional();

export const membershipApplicationAdminUpdateSchema = z.object({
  application: z.object({
    email: z.string().email().max(200).optional(),
    phone: z.string().max(50).optional(),
    address: z.string().max(400).nullable().optional(),
    motivation: z.string().max(4000).nullable().optional(),
    meta: membershipApplicationMetaPatchSchema,
  }),
});

export const membershipApplicationAdminDecisionSchema = z.object({
  decision: z.object({
    status: z.enum(['approved', 'rejected']),
    membershipType: membershipApplicationMembershipTypeSchema,
    reason: z.string().max(2000).nullable().optional(),
    chairAuthKind: membershipApplicationChairAuthKindSchema,
    chairAuthFileId: z.string().uuid(),
  }),
});

export const membershipApplicationAdminChairAuthUploadSchema = z.object({
  kind: membershipApplicationChairAuthKindSchema,
});
