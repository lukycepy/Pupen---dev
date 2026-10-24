import { NextRequest, NextResponse } from 'next/server';

function isAllowedRemoteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export async function GET(req: NextRequest) {
  const remoteUrl = req.nextUrl.searchParams.get('url') || '';
  if (!isAllowedRemoteUrl(remoteUrl)) {
    return new NextResponse('Invalid url', { status: 400 });
  }

  try {
    const res = await fetch(remoteUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 Pupen/1.0',
        accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      cache: 'force-cache',
    });

    if (!res.ok) {
      return new NextResponse('Upstream image failed', { status: 502 });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Unsupported content type', { status: 415 });
    }

    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse('Image proxy failed', { status: 502 });
  }
}
