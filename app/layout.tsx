import './globals.css'
import { Inter, Montserrat } from 'next/font/google'
import Providers from './providers'
import ServiceWorker from './components/ServiceWorker'

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
  themeColor: '#16a34a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cs" className={`scroll-smooth ${inter.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} bg-stone-50 text-stone-900 antialiased font-sans`} suppressHydrationWarning>
        <Providers>
          {children}
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  )
}
