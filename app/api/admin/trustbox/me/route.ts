import { NextResponse } from 'next/server';
import { requireTrustBoxAdmin } from '@/lib/server-auth';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Error';
}

export async function GET(req: Request) {
  try {
    const auth = await requireTrustBoxAdmin(req);
    return NextResponse.json({ ok: true, canViewPii: auth.canViewPii, isSuperadmin: auth.isSuperadmin });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 403 });
  }
}
