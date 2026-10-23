import { NextResponse } from 'next/server';
import { getBearerToken, getEffectiveProfileByToken } from '@/lib/server-auth';

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || 'Error');
  }
  return String(error || 'Error');
}

export async function GET(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) throw new Error('Unauthorized');
    const { profile } = await getEffectiveProfileByToken(token);
    return NextResponse.json({ profile: profile || null });
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
