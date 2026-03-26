import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Jméno musí mít alespoň 2 znaky' }),
  email: z.string().email({ message: 'Neplatná e-mailová adresa' }),
  subject: z.string().optional(),
  message: z.string().min(10, { message: 'Zpráva musí mít alespoň 10 znaků' }),
  turnstileToken: z.string().optional(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;