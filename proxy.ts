import { NextResponse, type NextRequest } from 'next/server';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/Autodiscover/Autodiscover.xml') {
    const url = req.nextUrl.clone();
    url.pathname = '/autodiscover/autodiscover.xml';
    return NextResponse.rewrite(url);
  }

  const isPublicFile = /\.[^/]+$/.test(pathname);
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/unsubscribe') ||
    pathname.startsWith('/autodiscover') ||
    pathname.startsWith('/Autodiscover') ||
    pathname.startsWith('/.well-known') ||
    isPublicFile
  ) {
    return NextResponse.next();
  }

  const hasLocale = pathname === '/cs' || pathname.startsWith('/cs/') || pathname === '/en' || pathname.startsWith('/en/');
  if (!hasLocale) {
    const url = req.nextUrl.clone();
    url.pathname = `/cs${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: ['/((?!_next|api).*)'],
};
