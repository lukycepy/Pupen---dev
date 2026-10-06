import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function getArg(name) {
  const i = process.argv.findIndex((x) => x === name);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function getEnvFromArgs() {
  const raw = getArg('--env');
  if (!raw) return null;
  const v = String(raw).toLowerCase();
  if (v === 'prod' || v === 'production') return 'prod';
  if (v === 'staging') return 'staging';
  return null;
}

function getDbUrl() {
  const env = getEnvFromArgs();
  if (env === 'staging') return process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL || null;
  if (env === 'prod') return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL || null;
  return process.env.DATABASE_URL || null;
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

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

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += String(d)));
    p.stderr.on('data', (d) => (err += String(d)));
    p.on('error', reject);
    p.on('close', (code) => resolve({ code: Number(code || 0), out, err }));
  });
}

async function main() {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    console.error('Missing DATABASE_URL (or DATABASE_URL_STAGING / DATABASE_URL_PROD with --env)');
    process.exit(1);
  }

  const outDir = process.env.BACKUP_DIR ? String(process.env.BACKUP_DIR) : path.join('ops', 'backup-artifacts');
  ensureDir(outDir);

  const envTag = getEnvFromArgs() || 'default';
  const fileBase = `db_${envTag}_${stamp()}.dump`;
  const filePath = path.join(outDir, fileBase);

  const res = await run('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', dbUrl, '--file', filePath]);
  if (res.code !== 0) {
    console.error(res.err || `pg_dump failed with code ${res.code}`);
    process.exit(1);
  }

  const hash = sha256File(filePath);
  fs.writeFileSync(`${filePath}.sha256`, `${hash}  ${path.basename(filePath)}\n`, 'utf8');

  const stat = fs.statSync(filePath);
  const logPath = path.join(outDir, 'backup-log.jsonl');
  const entry = {
    at: new Date().toISOString(),
    type: 'db',
    env: envTag,
    file: fileBase,
    bytes: stat.size,
    sha256: hash,
    ok: true,
  };
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');

  console.log(JSON.stringify({ ok: true, file: filePath, bytes: stat.size, sha256: hash }));
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

