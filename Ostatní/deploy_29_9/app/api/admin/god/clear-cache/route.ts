import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    (globalThis as any).__PUPEN_SITE_CONFIG_CACHE__ = { value: null, atMs: 0 };
    (globalThis as any).__PUPEN_DICTIONARY_CACHE__ = {};
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === 'Unauthorized' ? 401 : e?.message === 'Forbidden' ? 403 : 500;
    return NextResponse.json({ error: e?.message || 'Error' }, { status });
  }
}

