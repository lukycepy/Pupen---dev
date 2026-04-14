import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function sha256File(filePath) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(1024 * 1024);
    while (true) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (!n) break;
      h.update(buf.subarray(0, n));
    }
  } finally {
    fs.closeSync(fd);
  }
  return h.digest('hex');
}

function parseSha256File(p) {
  const raw = fs.readFileSync(p, 'utf8').trim();
  const m = raw.match(/^([a-f0-9]{64})\s{2}(.+)$/i);
  if (!m) return null;
  return { hash: m[1].toLowerCase(), file: m[2] };
}

function main() {
  const baseDir = process.env.BACKUP_DIR ? String(process.env.BACKUP_DIR) : path.join('ops', 'backup-artifacts');
  if (!fs.existsSync(baseDir)) {
    console.error(`Backup dir not found: ${baseDir}`);
    process.exit(1);
  }

  const entries = fs
    .readdirSync(baseDir)
    .filter((f) => f.endsWith('.sha256'))
    .map((f) => path.join(baseDir, f));

  if (!entries.length) {
    console.error('No .sha256 files found.');
    process.exit(2);
  }

  const results = [];
  for (const shaPath of entries) {
    const parsed = parseSha256File(shaPath);
    if (!parsed) {
      results.push({ sha256File: shaPath, ok: false, error: 'Invalid sha256 file format' });
      continue;
    }
    const filePath = path.join(path.dirname(shaPath), parsed.file);
    if (!fs.existsSync(filePath)) {
      results.push({ sha256File: shaPath, file: filePath, ok: false, error: 'Missing dump file' });
      continue;
    }
    const actual = sha256File(filePath);
    const ok = actual === parsed.hash;
    results.push({ sha256File: shaPath, file: filePath, expected: parsed.hash, actual, ok });
  }

  const okAll = results.every((r) => r.ok);
  console.log(JSON.stringify({ ok: okAll, checked: results.length, results }, null, 2));
  process.exit(okAll ? 0 : 3);
}

main();

