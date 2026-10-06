import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';
import {
  readKontaktyJson,
  writeKontaktyJsonAtomically,
  incrementForSave,
  sanitizeJsonOutput,
} from '@/lib/apps-linka/storage';
import {
  LinkaContactSchema,
  LinkaPayloadSchema,
  DEFAULT_LINKA_DATA,
  LinkaContact,
  validateContacts,
  CSV_HEADER,
  contactToCsvRow,
  parseCsv,
} from '@/lib/apps-linka/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SaveRequestSchema = z.object({
  contacts: z.array(z.any()),
});

async function withAdmin(req: Request) {
  try {
    return await requireAdmin(req);
  } catch (e: any) {
    const msg = e?.message || 'Unauthorized';
    return NextResponse.json({ error: msg, ok: false }, { status: /Forbidden/i.test(msg) ? 403 : 401 });
  }
  return null;
}

export async function GET(req: Request) {
  const auth = await withAdmin(req);
  if (!auth || auth instanceof NextResponse) return auth as unknown as NextResponse;

  const read = readKontaktyJson();
  const payload = sanitizeJsonOutput(read.payload);
  return NextResponse.json({
    ok: true,
    data: payload,
    meta: {
      source: read.source,
      path: read.pathUsed,
    },
  }, {
    headers: {
      'Cache-Control': 'no-cache, must-revalidate',
    },
  });
}

export async function POST(req: Request) {
  const auth = await withAdmin(req);
  if (!auth || auth instanceof NextResponse) return auth as unknown as NextResponse;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Neplatný JSON požadavek' }, { status: 400 });
  }

  const mode: 'save' | 'import' | 'export' = String(body?.mode || 'save') as any;
  if (mode === 'export') {
    const read = readKontaktyJson();
    const format: 'json' | 'csv' = String(body?.format || 'json') as any;
    if (format === 'csv') {
      const lines = [CSV_HEADER];
      for (const c of read.payload.contacts) lines.push(contactToCsvRow(c));
      return NextResponse.json({
        ok: true,
        content: lines.join('\n'),
        filename: 'linka-kontakty.csv',
        mime: 'text/csv; charset=utf-8',
      });
    }
    return NextResponse.json({
      ok: true,
      content: JSON.stringify(read.payload, null, 2) + '\n',
      filename: 'linka-kontakty.json',
      mime: 'application/json; charset=utf-8',
    });
  }

  if (mode === 'import') {
    const rawFormat: 'json' | 'csv' = String(body?.format || 'json') as any;
    const rawText = String(body?.content || '');
    if (!rawText.trim()) {
      return NextResponse.json({ ok: false, error: 'Importovaný soubor je prázdný' }, { status: 400 });
    }
    let imported: LinkaContact[] = [];
    try {
      if (rawFormat === 'csv') {
      imported = parseCsv(rawText);
    } else {
      const parsed = JSON.parse(rawText);
      if (Array.isArray(parsed)) imported = parsed;
      else if (parsed && Array.isArray(parsed.contacts)) imported = parsed.contacts;
      else return NextResponse.json({ ok: false, error: 'Neplatný JSON import (očekávám pole nebo objekt s contacts[])' }, { status: 400 });
    }
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: 'Chyba parsování importu: ' + (e?.message || e) }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      preview: imported,
    });
  }

  const parsed = SaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Chybí pole contacts' }, { status: 400 });
  }

  const rawContacts = parsed.data.contacts as any[];

  const cleaned: LinkaContact[] = [];
  const idMap = new Map<number, number>();
  let nextFree = 1;
  for (let i = 0; i < rawContacts.length; i++) {
    const c = rawContacts[i];
    if (c && typeof c === 'object') {
      const candId = Number(c.id);
      let id = Number.isFinite(candId) && candId > 0 ? Math.floor(candId) : 0;
      if (id <= 0) {
        while (idMap.has(nextFree)) nextFree++;
        id = nextFree;
        nextFree++;
      }
      idMap.set(id, i);
    }
    cleaned.push({
      id: 0,
      jmeno: String(c?.jmeno || ''),
      oddeleni: String(c?.oddeleni || ''),
      fakulta: String(c?.fakulta || ''),
      budova: String(c?.budova || ''),
      mistnost: String(c?.mistnost || ''),
      klapka: String(c?.klapka || ''),
      email: String(c?.email || ''),
    });
  }

  const fixedIds: LinkaContact[] = [];
  const usedIds = new Set<number>();
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    const orig = rawContacts[i];
    const origId = Number(orig?.id);
    let id = Number.isFinite(origId) && origId > 0 ? Math.floor(origId) : 0;
    if (id > 0 && !usedIds.has(id)) {
      usedIds.add(id);
    } else {
      let cand = 1;
      while (usedIds.has(cand)) cand++;
      id = cand;
      usedIds.add(id);
    }
    fixedIds.push({ ...c, id });
  }

  const validated: LinkaContact[] = [];
  for (const c of fixedIds) {
    const r = LinkaContactSchema.safeParse(c);
    if (r.success) validated.push(r.data);
    else validated.push(c);
  }

  const errors = validateContacts(validated);
  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'Validace selhala', errors, contacts: validated },
      { status: 400 },
    );
  }

  try {
    const existingRead = readKontaktyJson();
    const next = incrementForSave(existingRead.payload, validated);

    const finalCheck = LinkaPayloadSchema.safeParse(next);
    if (!finalCheck.success) {
      return NextResponse.json(
        { ok: false, error: 'Výsledné JSON schéma není platné', details: finalCheck.error.issues },
        { status: 400 },
      );
    }

    const result = writeKontaktyJsonAtomically(next);
    const reread = readKontaktyJson();
    const warnedEmpty = reread.payload.contacts.length === 0;

    return NextResponse.json({
      ok: true,
      version: result.version,
      lastUpdated: reread.payload.lastUpdated,
      countContacts: reread.payload.contacts.length,
      path: result.path,
      warnedEmpty,
      data: reread.payload,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'Chyba při zápisu souboru: ' + (e?.message || String(e)) },
      { status: 500 },
    );
  }
}
