import './globals.css'
import { Inter, Montserrat } from 'next/font/google'
import type { Viewport } from 'next'
import Providers from './providers'
import ServiceWorker from './components/ServiceWorker'
import ThemeSync from './components/ThemeSync'
import { ErrorReporter } from '@/components/ErrorReporter';
import { WebVitalsReporter } from '@/components/WebVitalsReporter';
import SelfHostedAnalytics from './components/SelfHostedAnalytics';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-montserrat',
})

export const metadata = {
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#16a34a' },
    { media: '(prefers-color-scheme: dark)', color: '#052e16' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cs" className={`scroll-smooth ${inter.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} text-stone-900 antialiased font-sans`} suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var k='pupen_theme';var v=localStorage.getItem(k);var p=(v==='dark'||v==='light'||v==='system')?v:'system';var hasMM=typeof window.matchMedia==='function';var r=(p==='system'&&hasMM)?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):(p==='dark'?'dark':'light');var root=document.documentElement;root.dataset.theme=r;root.dataset.themePreference=p;try{root.style.colorScheme=r;}catch(e){}try{if(r==='dark'){root.classList.add('dark');}else{root.classList.remove('dark');}}catch(e){}try{if(r==='dark'){var meta=document.querySelector('meta[name=\"theme-color\"][media*=\"dark\"]');if(!meta){meta=document.createElement('meta');meta.name='theme-color';meta.setAttribute('media','(prefers-color-scheme: dark)');document.head.appendChild(meta);}meta.setAttribute('content','#052e16');}}catch(e){}}catch(e){try{document.documentElement.classList.remove('dark');document.documentElement.dataset.theme='light';}catch(_){}}})();",
          }}
        />
        <Providers>
          <ThemeSync />
          <ErrorReporter />
          <WebVitalsReporter />
          <SelfHostedAnalytics />
          {children}
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  )
}
