import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

function resolvePreferredLocale(cookieLocale?: string): 'cs' | 'en' {
  if (cookieLocale === 'cs' || cookieLocale === 'en') return cookieLocale;
  return 'cs';
}

export default async function Home() {
  const cookieStore = await cookies();
  const locale = resolvePreferredLocale(cookieStore.get('NEXT_LOCALE')?.value);
  redirect(`/${locale}`);
}
