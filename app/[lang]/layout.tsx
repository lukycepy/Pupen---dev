// app/[lang]/layout.tsx
import type { Metadata, Viewport } from 'next';
import { getDictionary } from '@/lib/get-dictionary';
import Providers from '../providers'


// Import komponent
import Navbar from './components/Navbar' 
import Footer from './components/Footer' 
import CookieBanner from './components/CookieBanner'
import Banner from './components/Banner'
import FAQWidget from './components/FAQWidget'
import { ErrorReporter } from '@/components/ErrorReporter';
import { getPublicBaseUrl } from '@/lib/public-base-url';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const locale = lang === 'en' ? 'en_US' : 'cs_CZ';
  const canonical = `/${lang}`;
  const ogImage = '/img/prezentace_pupen.jpg';
  const baseUrl = getPublicBaseUrl();

  return {
    title: {
      default: 'Studentský spolek Pupen, z.s.',
      template: '%s | Studentský spolek Pupen, z.s.',
    },
    description: 'Oficiální web Studentského spolku Pupen, z.s. na FAPPZ ČZU.',
    metadataBase: new URL(baseUrl),
    keywords: ['Pupen', 'FAPPZ', 'ČZU', 'spolek', 'studenti', 'Suchdol'],
    authors: [{ name: 'Studentský spolek Pupen, z.s.' }],
    creator: 'Studentský spolek Pupen, z.s.',
    publisher: 'Studentský spolek Pupen, z.s.',
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    alternates: {
      canonical,
      languages: {
        'cs': `${baseUrl}/cs`,
        'en': `${baseUrl}/en`,
        'x-default': `${baseUrl}/cs`
      },
    },
    openGraph: {
      title: 'Studentský spolek Pupen | FAPPZ ČZU',
      description: 'Přidej se k nám a zažij nejlepší studentská léta na ČZU.',
      url: `${baseUrl}${canonical}`,
      siteName: 'Studentský spolek Pupen, z.s.',
      locale,
      type: 'website',
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Studentský spolek Pupen | FAPPZ ČZU',
      description: 'Přidej se k nám a zažij nejlepší studentská léta na ČZU.',
      images: [ogImage],
    },
    robots: 'index, follow',
    icons: {
      icon: '/favicon.ico',
      apple: '/apple-icon.png',
    },
    manifest: '/manifest.json',
  };
}

export const viewport: Viewport = {
  themeColor: '#16a34a',
  width: 'device-width',
  initialScale: 1,
}

export async function generateStaticParams() {
  return [{ lang: 'cs' }, { lang: 'en' }]
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}) {
  // 1. Rozbalení parametrů (Next.js 15)
  const { lang } = await params;
  
  // 2. Načtení slovníku podle aktuálního jazyka
  let dict: any = {};
  try {
    dict = await getDictionary(lang);
  } catch {
    dict = { nav: {}, footer: {}, homePage: {} };
  }

  return (
    <Providers>
      <ErrorReporter />
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-green-600 text-white p-4 z-[100] rounded-xl font-bold shadow-xl">
        {lang === 'en' ? 'Skip to content' : 'Přeskočit na obsah'}
      </a>
      <div data-pupen-banner>
        <Banner lang={lang} dict={dict.homePage} />
      </div>
      {/* 3. Předání slovníku do komponenty Navbar - oprava předávání celého dict.nav */}
      <div data-pupen-navbar>
        <Navbar lang={lang} dict={dict.nav || {}} />
      </div>

      <div className="flex flex-col min-h-screen">
        <main id="main-content" className="flex-grow">
          {children}
        </main>

        <div data-pupen-footer>
          <Footer lang={lang} dict={dict.footer} />
        </div>
      </div>
      
      <div data-pupen-cookie>
        <CookieBanner lang={lang} dict={dict} />
      </div>
      <div data-pupen-faq>
        <FAQWidget lang={lang} />
      </div>
    </Providers>
  )
}
