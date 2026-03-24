import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const isEn = lang === 'en';
  const title = isEn ? 'News' : 'Novinky';
  const description = isEn
    ? 'Articles and updates from Pupen.'
    : 'Články a novinky ze spolku Pupen.';

  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/novinky`,
      languages: { 'cs-CZ': '/cs/novinky', 'en-US': '/en/novinky' },
    },
    openGraph: {
      title,
      description,
      url: `https://pupen.org/${lang}/novinky`,
      type: 'website',
    },
  };
}

export default function NovinkyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
