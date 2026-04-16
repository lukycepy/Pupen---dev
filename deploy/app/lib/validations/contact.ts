import { z } from 'zod';

export const contactFormSchema = z.object({
  name: z.string().min(2, { message: 'Jméno musí mít alespoň 2 znaky' }).max(100, { message: 'Jméno je příliš dlouhé' }),
  email: z.string().email({ message: 'Neplatná e-mailová adresa' }).max(150, { message: 'E-mail je příliš dlouhý' }),
  subject: z.string().max(200, { message: 'Předmět je příliš dlouhý' }).optional(),
  message: z.string().min(10, { message: 'Zpráva musí mít alespoň 10 znaků' }).max(3000, { message: 'Zpráva je příliš dlouhá' }),
  turnstileToken: z.string().optional(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;