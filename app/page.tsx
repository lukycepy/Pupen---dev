import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

function resolvePreferredLocale(acceptLanguage: string, cookieLocale?: string): 'cs' | 'en' {
  if (cookieLocale === 'cs' || cookieLocale === 'en') return cookieLocale;
  const normalized = String(acceptLanguage || '').toLowerCase();
  return normalized.includes('en') ? 'en' : 'cs';
}

export default async function Home() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = resolvePreferredLocale(
    headerStore.get('accept-language') || '',
    cookieStore.get('NEXT_LOCALE')?.value,
  );
  redirect(`/${locale}`);
}
