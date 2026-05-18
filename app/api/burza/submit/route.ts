import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase-server';
import { guardPublicJsonPost } from '@/lib/public-post-guard';

export async function POST(req: Request) {
  return NextResponse.json({ error: 'Burza učebnic je ukončena.' }, { status: 410 });
}
