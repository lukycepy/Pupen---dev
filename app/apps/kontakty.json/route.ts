import { NextResponse } from 'next/server';
import { readKontaktyJson, sanitizeJsonOutput } from '@/lib/apps-linka/storage';
import { DEFAULT_LINKA_DATA, LinkaPayloadSchema } from '@/lib/apps-linka/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildSafePayload(raw: unknown): { json: string; status: number } {
  try {
    let payload = null as any;
    let status = 200;
    try {
      const { payload: read } = readKontaktyJson();
      payload = sanitizeJsonOutput(read);
    } catch {
      payload = sanitizeJsonOutput(structuredClone(DEFAULT_LINKA_DATA));
    }
    const validated = LinkaPayloadSchema.safeParse(payload);
    if (!validated.success) {
      payload = sanitizeJsonOutput(structuredClone(DEFAULT_LINKA_DATA));
      status = 200;
    }
    const json = JSON.stringify(payload, null, 2) + '\n';
    JSON.parse(json);
    return { json, status };
  } catch {
    const fallback = sanitizeJsonOutput(structuredClone(DEFAULT_LINKA_DATA));
    return { json: JSON.stringify(fallback, null, 2) + '\n', status: 200 };
  }
}

const COMMON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-cache, must-revalidate',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff',
};

export async function GET(): Promise<NextResponse> {
  const { json, status } = buildSafePayload(null);
  return new NextResponse(json, {
    status,
    headers: COMMON_HEADERS,
  });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: COMMON_HEADERS,
  });
}
