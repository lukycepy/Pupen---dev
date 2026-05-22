import { NextResponse } from 'next/server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_req: Request) {
  return NextResponse.json({ error: 'Burza učebnic je ukončena.' }, { status: 410 });
}
