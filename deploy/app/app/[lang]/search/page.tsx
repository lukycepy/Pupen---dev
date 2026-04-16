import SearchClient from './search-client';

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang: rawLang } = await params;
  const lang = rawLang === 'en' ? 'en' : 'cs';
  const sp = (await searchParams) || {};
  const q = typeof sp.q === 'string' ? sp.q : '';
  return <SearchClient lang={lang} initialQ={q} />;
}
