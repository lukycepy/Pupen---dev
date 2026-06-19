import HomePageClient from './HomePageClient';

export default async function PupenWeb({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return <HomePageClient lang={lang || 'cs'} />;
}
