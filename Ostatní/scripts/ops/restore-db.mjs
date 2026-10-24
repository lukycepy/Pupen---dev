import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Sdílíme načítání `.env` s `db:*` skripty, aby šla obnova spustit i z cronu,
// kde nejsou proměnné exportované v shellu.
const require = createRequire(import.meta.url);
const { loadDotEnv, sanitizeForPgTools } = require('../db/utils.js');

function getArg(name) {
  const i = process.argv.findIndex((x) => x === name);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function getEnvFromArgs() {
  const raw = getArg('--env');
  if (!raw) return null;
  const v = String(raw).toLowerCase();
  if (v === 'prod' || v === 'production') return 'prod';
  if (v === 'staging') return 'staging';
  if (v === 'local') return 'local';
  return null;
}

function getDbUrl(env) {
  // Explicitní `--env staging` / `--env local` nesmí tiše spadnout zpět na
  // `DATABASE_URL` (ten ukazuje na produkci). Prázdná proměnná = chyba.
  if (env === 'staging') return process.env.DATABASE_URL_STAGING || null;
  if (env === 'prod') return process.env.DATABASE_URL_PROD || process.env.DATABASE_URL || null;
  if (env === 'local') return process.env.DATABASE_URL_LOCAL || null;
  return process.env.DATABASE_URL || null;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', ...opts });
    p.on('error', reject);
    p.on('close', (code) => resolve(Number(code || 0)));
  });
}

async function main() {
  loadDotEnv(getEnvFromArgs());
  const from = getArg('--from');
  if (!from) {
    console.error('Missing --from <path-to-dump>');
    process.exit(1);
  }

  const absFrom = path.isAbsolute(from) ? from : path.join(process.cwd(), from);
  if (!fs.existsSync(absFrom)) {
    console.error(`Dump file not found: ${absFrom}`);
    process.exit(1);
  }

  const env = getEnvFromArgs() || 'staging';
  const dbUrl = getDbUrl(env);
  if (!dbUrl) {
    console.error('Missing DATABASE_URL (or DATABASE_URL_STAGING / DATABASE_URL_PROD / DATABASE_URL_LOCAL with --env)');
    process.exit(1);
  }

  if (!hasFlag('--yes')) {
    console.error('Refusing to restore without explicit confirmation. Re-run with --yes.');
    process.exit(2);
  }

  if (env === 'prod' && !hasFlag('--allow-prod')) {
    console.error('Refusing to restore into prod without --allow-prod.');
    process.exit(2);
  }

  const ext = path.extname(absFrom).toLowerCase();
  const isCustomDump = ext === '.dump' || ext === '.backup' || ext === '.bak';

  // libpq (`pg_restore`/`psql`) nezná `uselibpqcompat` – očistíme URL a
  // `sslmode` předáme přes `PGSSLMODE`, aby spojení zůstalo šifrované.
  const { url: targetUrl, sslmode } = sanitizeForPgTools(dbUrl);
  const spawnEnv = { ...process.env };
  if (sslmode) spawnEnv.PGSSLMODE = sslmode;

  if (isCustomDump) {
    const code = await run(
      'pg_restore',
      ['--clean', '--if-exists', '--no-owner', '--no-privileges', '--dbname', targetUrl, absFrom],
      { env: spawnEnv }
    );
    if (code !== 0) process.exit(code);
    console.log(JSON.stringify({ ok: true, restored: absFrom, env }));
    return;
  }

  const code = await run('psql', ['--set', 'ON_ERROR_STOP=1', targetUrl, '--file', absFrom], {
    env: spawnEnv,
  });
  if (code !== 0) process.exit(code);
  console.log(JSON.stringify({ ok: true, restored: absFrom, env }));
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});

