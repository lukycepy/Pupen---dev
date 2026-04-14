import { NextResponse } from 'next/server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    return NextResponse.json({ ok: true, canViewPii: auth.canViewPii, isSuperadmin: auth.isSuperadmin });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Error' }, { status: 403 });
  }
}

