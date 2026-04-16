import { z } from 'zod';

export const applicationSubmitSchema = z.object({
  membership_type: z.enum(['regular', 'external']).default('regular'),
  first_name: z.string().min(1, { message: 'Zadejte jméno.' }).max(80, { message: 'Jméno je příliš dlouhé.' }),
  last_name: z.string().min(1, { message: 'Zadejte příjmení.' }).max(80, { message: 'Příjmení je příliš dlouhé.' }),
  email: z.string().email({ message: 'Neplatná e-mailová adresa.' }).max(200),
  phone: z.string().min(6, { message: 'Zadejte telefon.' }).max(50),
  address: z.string().optional().nullable(),
  address_meta: z.any().optional(),
  membership_type_label: z.string().optional().nullable(),
  university_email: z.string().optional().nullable(),
  field_of_study: z.string().optional().nullable(),
  study_year: z.string().optional().nullable(),
  signed_on: z.string().optional().nullable(),
  gdpr_consent: z.boolean(),
  applicant_signature: z.string().min(10, { message: 'Chybí podpis.' }),
  lang: z.string().optional(),
  hp: z.string().optional(),
  website: z.string().optional(),
});

export type ApplicationSubmitData = z.infer<typeof applicationSubmitSchema>;

