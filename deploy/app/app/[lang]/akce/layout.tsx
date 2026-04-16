import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const isEn = lang === 'en';
  const title = isEn ? 'Events' : 'Akce';
  const description = isEn
    ? 'Events, workshops and meetups by Pupen.'
    : 'Akce, workshopy a setkání spolku Pupen.';

  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}/akce`,
      languages: { 'cs-CZ': '/cs/akce', 'en-US': '/en/akce' },
    },
    openGraph: {
      title,
      description,
      url: `https://pupen.org/${lang}/akce`,
      type: 'website',
    },
  };
}

export default function AkceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
