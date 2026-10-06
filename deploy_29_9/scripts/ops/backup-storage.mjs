import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function safeJoin(root, rel) {
  const cleaned = String(rel || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..')
    .join('/');
  return path.join(root, cleaned);
}

function parseBucketsFromEnv() {
  const raw = process.env.BACKUP_STORAGE_BUCKETS ? String(process.env.BACKUP_STORAGE_BUCKETS) : '';
  const parts = raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function promisePool(items, limit, worker) {
  const out = [];
  let i = 0;
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) break;
      out[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return out;
}

async function listAllPaths(supabase, bucket, prefix) {
  const out = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const res = await supabase.storage.from(bucket).list(prefix || '', { limit, offset });
    if (res.error) throw res.error;
    const rows = Array.isArray(res.data) ? res.data : [];
    if (!rows.length) break;

    for (const it of rows) {
      const name = String(it?.name || '');
      if (!name) continue;
      const isFolder = it?.id == null && it?.metadata == null;
      const nextPrefix = prefix ? `${prefix}/${name}` : name;
      if (isFolder) {
        const nested = await listAllPaths(supabase, bucket, nextPrefix);
        for (const p of nested) out.push(p);
      } else {
        out.push(nextPrefix);
      }
    }

    if (rows.length < limit) break;
    offset += rows.length;
  }

  return out;
}

async function downloadOne(supabase, bucket, objectPath, outRoot) {
  const res = await supabase.storage.from(bucket).download(objectPath);
  if (res.error) throw res.error;
  const blob = res.data;
  const ab = await blob.arrayBuffer();
  const buf = Buffer.from(ab);
  const filePath = safeJoin(path.join(outRoot, bucket), objectPath);
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, buf);
  return { path: objectPath, bytes: buf.length };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ? String(process.env.NEXT_PUBLIC_SUPABASE_URL) : '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ? String(process.env.SUPABASE_SERVICE_ROLE_KEY) : '';
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const outDir = process.env.BACKUP_DIR ? String(process.env.BACKUP_DIR) : path.join('ops', 'backup-artifacts');
  ensureDir(outDir);
  const runDir = path.join(outDir, `storage_${stamp()}`);
  ensureDir(runDir);

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let buckets = parseBucketsFromEnv();
  if (!buckets) {
    const r = await supabase.storage.listBuckets();
    if (r.error) throw r.error;
    const includePublic = String(process.env.BACKUP_STORAGE_INCLUDE_PUBLIC || '').toLowerCase() === 'true';
    buckets = (r.data || [])
      .filter((b) => includePublic || !b.public)
      .map((b) => String(b.name || b.id || '').trim())
      .filter(Boolean);
  }

  const concurrency = Math.min(10, Math.max(1, Number(process.env.BACKUP_STORAGE_CONCURRENCY || 4)));
  const manifest = { at: new Date().toISOString(), runDir: path.relative(process.cwd(), runDir), buckets: [] };

  for (const bucket of buckets) {
    const b = String(bucket || '').trim();
    if (!b) continue;
    const paths = await listAllPaths(supabase, b, '');
    const results = await promisePool(paths, concurrency, async (p) => downloadOne(supabase, b, p, runDir));
    const totalBytes = results.reduce((s, r) => s + Number(r?.bytes || 0), 0);
    manifest.buckets.push({ bucket: b, files: results.length, bytes: totalBytes });
  }

  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const logPath = path.join(outDir, 'backup-log.jsonl');
  fs.appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), type: 'storage', ok: true, runDir: path.relative(process.cwd(), runDir), buckets: manifest.buckets })}\n`, 'utf8');

  console.log(JSON.stringify({ ok: true, runDir, buckets: manifest.buckets }));
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

