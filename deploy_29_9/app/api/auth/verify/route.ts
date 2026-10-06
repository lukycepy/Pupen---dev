import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = String(searchParams.get('u') || '').trim();
  if (!raw) return NextResponse.json({ error: 'Missing u' }, { status: 400 });

  let target: URL;
  try {
    target = new URL(decodeURIComponent(raw));
  } catch {
    return NextResponse.json({ error: 'Invalid u' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const allowedOrigin = new URL(supabaseUrl).origin;
  if (target.origin !== allowedOrigin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!target.pathname.startsWith('/auth/v1/verify')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.redirect(target.toString(), 302);
}

