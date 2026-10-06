import AkcePageClient from './AkcePageClient';

export default async function AkcePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return <AkcePageClient lang={lang || 'cs'} />;
}
