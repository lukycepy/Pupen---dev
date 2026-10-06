import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { DEFAULT_LINKA_DATA, LinkaPayload, LinkaPayloadSchema } from './types';

export function getAppsDataDir(): string {
  const explicit = process.env.APPS_DATA_DIR;
  if (explicit) return path.resolve(explicit);
  const repoRoot = process.cwd();
  return path.join(repoRoot, 'public', 'apps');
}

export function getKontaktyJsonPath(): string {
  return path.join(getAppsDataDir(), 'kontakty.json');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function stripBomAndTrim(text: string): string {
  const s = String(text || '');
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1).trim();
  return s.trim();
}

export function sanitizeJsonOutput(payload: LinkaPayload): LinkaPayload {
  return {
    version: Math.floor(Number(payload.version) || 1),
    lastUpdated: String(payload.lastUpdated || new Date(0).toISOString()),
    contacts: Array.isArray(payload.contacts)
      ? payload.contacts.map((c) => ({
          id: Math.floor(Number(c.id) || 0),
          jmeno: String(c.jmeno || '').trim(),
          oddeleni: String(c.oddeleni || '').trim(),
          fakulta: String(c.fakulta || '').trim(),
          budova: String(c.budova || '').trim(),
          mistnost: String(c.mistnost || '').trim(),
          klapka: String(c.klapka || '').trim(),
          email: String(c.email || '').trim().toLowerCase(),
        }))
      : [],
  };
}

export function readKontaktyJson(): { payload: LinkaPayload; source: 'file' | 'default'; pathUsed: string } {
  const filePath = getKontaktyJsonPath();
  try {
    if (fs.existsSync(filePath)) {
      const raw = stripBomAndTrim(fs.readFileSync(filePath, 'utf8'));
      if (raw) {
        const parsed = JSON.parse(raw);
        const validated = LinkaPayloadSchema.safeParse(parsed);
        if (validated.success) {
          return { payload: sanitizeJsonOutput(validated.data), source: 'file', pathUsed: filePath };
        }
      }
    }
  } catch {
    // fall through to default
  }
  return { payload: structuredClone(DEFAULT_LINKA_DATA), source: 'default', pathUsed: filePath };
}

export function writeKontaktyJsonAtomically(payload: LinkaPayload): { path: string; version: number } {
  const filePath = getKontaktyJsonPath();
  ensureDir(path.dirname(filePath));

  const clean = sanitizeJsonOutput(payload);
  const validated = LinkaPayloadSchema.parse(clean);
  const json = JSON.stringify(validated, null, 2) + '\n';

  JSON.parse(json);

  const tmpName = `.kontakty-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.tmp`;
  const tmpPath = path.join(path.dirname(filePath), tmpName);
  try {
    fs.writeFileSync(tmpPath, json, { encoding: 'utf8', flag: 'w' });
    fs.renameSync(tmpPath, filePath);
  } catch (renameErr) {
    if ((renameErr as NodeJS.ErrnoException)?.code === 'EXDEV') {
      fs.copyFileSync(tmpPath, filePath);
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    } else {
      throw renameErr;
    }
  } finally {
    try {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    } catch {
      // ignore
    }
  }

  return { path: filePath, version: validated.version };
}

export function incrementForSave(existing: LinkaPayload | null, nextContacts: LinkaPayload['contacts']): LinkaPayload {
  const base: LinkaPayload = existing
    ? sanitizeJsonOutput(existing)
    : sanitizeJsonOutput(structuredClone(DEFAULT_LINKA_DATA));
  return {
    version: Math.floor(Number(base.version) || 0) + 1,
    lastUpdated: new Date().toISOString(),
    contacts: nextContacts,
  };
}
