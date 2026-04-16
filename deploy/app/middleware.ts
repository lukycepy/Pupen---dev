import { NextResponse, type NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/Autodiscover/Autodiscover.xml') {
    const url = req.nextUrl.clone();
    url.pathname = '/autodiscover/autodiscover.xml';
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/Autodiscover/Autodiscover.xml'],
};

