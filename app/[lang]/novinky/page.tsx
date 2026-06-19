import NewsPageClient from './NewsPageClient';

export default async function NovinkyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return <NewsPageClient lang={lang || 'cs'} />;
}
